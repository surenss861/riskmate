import express, { RequestHandler, type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { recordAuditLog } from "../middleware/audit";
import archiver from "archiver";
import { Readable } from "stream";
import { generateRiskSnapshotPDF } from "../utils/pdf";
import crypto from "crypto";
import { notifyReportReady, sendSignatureRequestNotification } from "../services/notifications";
import { buildJobReport } from "../utils/jobReport";
import { requireFeature } from "../middleware/limits";

export const reportsRouter: ExpressRouter = express.Router();

const ensuredBuckets = new Set<string>();

const BASE_SHARE_URL =
  process.env.REPORT_SHARE_BASE_URL ||
  process.env.FRONTEND_URL ||
  "https://www.riskmate.dev";

const SHARE_TOKEN_SECRET =
  process.env.REPORT_SHARE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "riskmate-share-secret";

const SHARE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

const toBase64Url = (value: string | Buffer) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string) =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function signSharePayload(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", SHARE_TOKEN_SECRET)
    .update(body)
    .digest();

  return `${toBase64Url(body)}.${toBase64Url(signature)}`;
}

function verifyShareToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid token format");
  }

  const [encodedBody, encodedSignature] = parts;
  const bodyBuffer = fromBase64Url(encodedBody);
  const providedSignature = fromBase64Url(encodedSignature);

  const expectedSignature = crypto
    .createHmac("sha256", SHARE_TOKEN_SECRET)
    .update(bodyBuffer)
    .digest();

  if (!crypto.timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error("Invalid token signature");
  }

  const payload = JSON.parse(bodyBuffer.toString("utf8")) as {
    job_id: string;
    organization_id: string;
    exp: number;
  };

  if (!payload.job_id || !payload.organization_id || !payload.exp) {
    throw new Error("Invalid token payload");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

async function ensureBucketExists(bucketId: string) {
  if (ensuredBuckets.has(bucketId)) {
    return;
  }

  const { data, error } = await supabase.storage.getBucket(bucketId);

  if (error || !data) {
    const { error: createError } = await supabase.storage.createBucket(bucketId, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    });

    if (createError) {
      throw createError;
    }
  }

  ensuredBuckets.add(bucketId);
}

// POST /api/reports/generate/:jobId
// Generates a Risk Snapshot PDF report for a job
reportsRouter.post("/generate/:jobId", authenticate as unknown as RequestHandler, (async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id, id: userId } = authReq.user;
    const { jobId } = req.params;

    let reportData;
    try {
      reportData = await buildJobReport(organization_id, jobId);
    } catch (err: any) {
      if (err?.message === "Job not found") {
        return res.status(404).json({ message: "Job not found" });
      }
      throw err;
    }

    if (!reportData?.job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const photoDocuments = (reportData.documents ?? []).filter(
      (doc) => doc.type === "photo" && doc.file_path
    );

    const photos = (
      await Promise.all(
        photoDocuments.map(async (document: any) => {
          try {
            const bucket = document.source_bucket === "evidence" ? "evidence" : "documents";
            const { data: fileData } = await supabase.storage
              .from(bucket)
              .download(document.file_path);

            if (!fileData) {
              return null;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            return {
              name: document.name,
              description: document.description,
              created_at: document.created_at,
              buffer: Buffer.from(arrayBuffer),
              category: document.category ?? undefined,
            };
          } catch (error) {
            console.warn("Failed to include photo in PDF", error);
            return null;
          }
        })
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateRiskSnapshotPDF(
        reportData.job,
        reportData.risk_score,
        reportData.mitigations || [],
        reportData.organization ?? {
          id: organization_id,
          name: reportData.job?.client_name ?? "Organization",
        },
        photos,
        reportData.audit || [],
        undefined // reportRunId - not used by this legacy route (no report_run created here)
      );
    } catch (pdfError: any) {
      console.error("PDF generation error:", pdfError);
      console.error("PDF error stack:", pdfError?.stack);
      throw new Error(`PDF generation failed: ${pdfError?.message || String(pdfError)}`);
    }

    const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const pdfBase64 = pdfBuffer.toString("base64");

    const { data: snapshot, error: snapshotError } = await supabase
      .from("report_snapshots")
      .insert({
        job_id: jobId,
        organization_id,
        payload: reportData,
      })
      .select()
      .single();

    if (snapshotError) {
      console.error("Snapshot creation failed:", snapshotError);
    }

    const snapshotId = snapshot?.id ?? null;

    let pdfUrl: string | null = null;
    let storagePath: string | null = null;
    let reportRecord: any = null;

    try {
      await ensureBucketExists("reports");
      const uploadPath = `${organization_id}/risk-snapshots/${jobId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("reports")
        .upload(uploadPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("PDF upload failed:", uploadError);
      } else {
        storagePath = uploadData?.path ?? uploadPath;

    const { data: signedData, error: signedError } = await supabase.storage
      .from("reports")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    if (signedError) {
      console.error("Signed URL creation failed:", signedError);
        } else {
          pdfUrl = signedData?.signedUrl ?? null;
    }

        const { data: inserted, error: reportError } = await supabase
      .from("risk_snapshot_reports")
      .insert({
        job_id: jobId,
        organization_id,
            pdf_url: pdfUrl ?? "",
        storage_path: storagePath,
        hash,
        generated_by: userId,
            snapshot_id: snapshotId,
      })
      .select()
      .single();

    if (reportError) {
      console.error("Report record creation failed:", reportError);
        } else {
          reportRecord = inserted;
        }
      }
    } catch (storageError) {
      console.error("Report storage pipeline failed:", storageError);
    }

    await recordAuditLog({
      organizationId: organization_id,
      actorId: userId,
      eventName: "report.generated",
      targetType: "report",
      targetId: reportRecord?.id ?? null,
      metadata: {
        job_id: jobId,
        storage_path: storagePath ?? null,
        hash,
        snapshot_id: snapshotId,
        mitigation_count: (reportData.mitigations ?? []).length,
      },
    });

    await notifyReportReady({
      organizationId: organization_id,
      jobId,
      pdfUrl,
    });

    // Always return pdf_base64 so frontend can download even if storage upload fails
    res.json({
      data: {
        id: reportRecord?.id ?? null,
        pdf_url: pdfUrl,
        storage_path: storagePath,
        hash,
        pdf_base64: pdfBase64, // Always include base64 for direct download
        snapshot_id: snapshotId,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    console.error("Error stack:", err?.stack);
    res.status(500).json({
      message: "Failed to generate PDF report",
      detail: err?.message ?? String(err),
      error: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    });
  }
}) as RequestHandler);

// POST /api/reports/runs/:reportRunId/ready-for-signatures
// Moves a draft report run to ready_for_signatures and sends signature request notifications.
// Body: { intendedSignerUserIds?: string[], jobTitle?: string }.
// If intendedSignerUserIds is omitted or empty, org members (excluding run creator) are notified.
reportsRouter.post(
  "/runs/:reportRunId/ready-for-signatures",
  authenticate as unknown as RequestHandler,
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { organization_id, id: userId } = authReq.user;
      const reportRunId = req.params.reportRunId;
      const body = req.body as { intendedSignerUserIds?: string[]; jobTitle?: string };
      let intendedSignerUserIds = Array.isArray(body?.intendedSignerUserIds)
        ? (body.intendedSignerUserIds as string[]).filter((id): id is string => typeof id === "string")
        : [];

      const { data: reportRun, error: fetchError } = await supabase
        .from("report_runs")
        .select("id, organization_id, status, job_id, generated_by")
        .eq("id", reportRunId)
        .eq("organization_id", organization_id)
        .single();

      if (fetchError || !reportRun) {
        return res.status(404).json({ message: "Report run not found" });
      }
      if (reportRun.status !== "draft") {
        return res.status(400).json({
          message: "Run is not in draft; only draft runs can be moved to ready_for_signatures",
        });
      }

      const { data: updated, error: updateError } = await supabase
        .from("report_runs")
        .update({ status: "ready_for_signatures" })
        .eq("id", reportRunId)
        .eq("organization_id", organization_id)
        .select()
        .single();

      if (updateError || !updated) {
        console.error("ready-for-signatures update failed:", updateError);
        return res.status(500).json({ message: "Failed to update report run" });
      }

      if (intendedSignerUserIds.length === 0) {
        const { data: memberRows } = await supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", organization_id);
        intendedSignerUserIds = (memberRows || [])
          .map((r: { user_id: string }) => r.user_id)
          .filter((id) => id && id !== reportRun.generated_by);
      }

      let jobTitleOrClientName = body?.jobTitle;
      if (jobTitleOrClientName == null && reportRun.job_id) {
        const { data: job } = await supabase
          .from("jobs")
          .select("client_name")
          .eq("id", reportRun.job_id)
          .eq("organization_id", organization_id)
          .single();
        jobTitleOrClientName = job?.client_name ?? undefined;
      }

      for (const uid of intendedSignerUserIds) {
        try {
          await sendSignatureRequestNotification(uid, reportRunId, jobTitleOrClientName);
        } catch (err) {
          console.error("sendSignatureRequestNotification failed for user", uid, err);
        }
      }

      res.json({ data: updated });
    } catch (err: any) {
      console.error("ready-for-signatures failed:", err);
      res.status(500).json({ message: "Failed to move run to ready_for_signatures" });
    }
  }
);

// POST /api/reports/notify-signature-request
// Sends signature request notifications to intended signers. Call after persisting a report run
// (e.g. when moving to ready_for_signatures). Body: { reportRunId, intendedSignerUserIds, jobTitle? }.
reportsRouter.post(
  "/notify-signature-request",
  authenticate as unknown as RequestHandler,
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { organization_id } = authReq.user;
      const body = req.body as { reportRunId?: string; intendedSignerUserIds?: string[]; jobTitle?: string };
      const { reportRunId, intendedSignerUserIds = [], jobTitle } = body;

      if (!reportRunId || !Array.isArray(intendedSignerUserIds) || intendedSignerUserIds.length === 0) {
        return res.status(400).json({ message: "reportRunId and non-empty intendedSignerUserIds required" });
      }

      let jobTitleOrClientName = jobTitle;
      if (jobTitleOrClientName == null) {
        const { data: run } = await supabase
          .from("report_runs")
          .select("job_id")
          .eq("id", reportRunId)
          .eq("organization_id", organization_id)
          .single();
        if (run?.job_id) {
          const { data: job } = await supabase
            .from("jobs")
            .select("client_name")
            .eq("id", run.job_id)
            .eq("organization_id", organization_id)
            .single();
          jobTitleOrClientName = job?.client_name ?? undefined;
        }
      }

      for (const uid of intendedSignerUserIds) {
        try {
          await sendSignatureRequestNotification(uid, reportRunId, jobTitleOrClientName);
        } catch (err) {
          console.error("sendSignatureRequestNotification failed for user", uid, err);
        }
      }

      res.status(204).end();
    } catch (err: any) {
      console.error("notify-signature-request failed:", err);
      res.status(500).json({ message: "Failed to send signature request notifications" });
    }
  }
);

reportsRouter.post(
  "/share/:jobId",
  // @ts-ignore - TypeScript doesn't recognize that authenticate middleware adds user property
  authenticate,
  requireFeature("share_links"),
  async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { jobId } = req.params;
    const { organization_id } = authReq.user;

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, organization_id")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + SHARE_TOKEN_TTL_SECONDS;
    const token = signSharePayload({
      job_id: jobId,
      organization_id,
      exp: expiresAt,
    });

    res.json({
      data: {
        url: `${BASE_SHARE_URL}/public/report/${token}`,
        token,
        expires_at: new Date(expiresAt * 1000).toISOString(),
      },
    });
  } catch (err: any) {
    console.error("Share link generation failed:", err);
    res.status(500).json({ message: "Failed to generate share link" });
  }
});

reportsRouter.get("/public/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const payload = verifyShareToken(token);

    const reportData = await buildJobReport(payload.organization_id, payload.job_id);

    res.json({
      data: reportData,
      shared_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Public report fetch failed:", err);
    const status = err?.message === "Token expired" ? 401 : 400;
    res.status(status).json({ message: err?.message || "Invalid token" });
  }
});

// GET /api/reports/:jobId
// Returns the latest report for a job
reportsRouter.get("/:jobId", authenticate as unknown as RequestHandler, (async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id } = authReq.user;
    const { jobId } = req.params;

    // Verify job belongs to organization
    const { data: job } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Get latest report
    const { data: report, error } = await supabase
      .from("risk_snapshot_reports")
      .select("*")
      .eq("job_id", jobId)
      .eq("organization_id", organization_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!report) {
      return res.status(404).json({ message: "No report found for this job" });
    }

    // Generate fresh signed URL if needed
    let pdfUrl = report.pdf_url;
    if (report.storage_path) {
      const { data: signedData } = await supabase.storage
        .from("reports")
        .createSignedUrl(report.storage_path, 60 * 60 * 24 * 7);

      if (signedData) {
        pdfUrl = signedData.signedUrl;
      }
    }

    res.json({
      data: {
        ...report,
        pdf_url: pdfUrl,
      },
    });
  } catch (err: any) {
    console.error("Report fetch failed:", err);
    res.status(500).json({ message: "Failed to fetch report" });
  }
}) as RequestHandler);

// POST /api/reports/permit-pack/:jobId
// Bundles selected documents into a downloadable zip file
reportsRouter.post("/permit-pack/:jobId", authenticate as unknown as RequestHandler, requireFeature("permit_pack") as unknown as RequestHandler, (async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { organization_id } = authReq.user;
    const { jobId } = req.params;
    const { options } = req.body || {};

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, organization_id, client_name")
      .eq("id", jobId)
      .eq("organization_id", organization_id)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Fetch related documents based on options
    const documentIds = options?.document_ids || [];
    let documents: any[] = [];

    if (documentIds.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("id, name, storage_path, type")
        .eq("job_id", jobId)
        .eq("organization_id", organization_id)
        .in("id", documentIds);

      if (docsError) throw docsError;
      documents = docs || [];
    }

    // Create zip archive in memory
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("error", (err) => {
      throw err;
    });

    // Add risk snapshot report if requested
    if (options?.include_risk_snapshot) {
      const { data: report } = await supabase
        .from("risk_snapshot_reports")
        .select("pdf_url, storage_path")
        .eq("job_id", jobId)
        .eq("organization_id", organization_id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();

      if (report?.storage_path) {
        // Download from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("reports")
          .download(report.storage_path);

        if (!downloadError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          archive.append(Buffer.from(arrayBuffer), { name: "risk-snapshot.pdf" });
        }
      }
    }

    // Add insurance documents if requested
    if (options?.include_insurance_docs) {
      const { data: insuranceDocs } = await supabase
        .from("documents")
        .select("name, storage_path, type")
        .eq("job_id", jobId)
        .eq("organization_id", organization_id)
        .eq("type", "insurance_certificate");

      if (insuranceDocs) {
        for (const doc of insuranceDocs) {
          if (doc.storage_path) {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from("documents")
              .download(doc.storage_path);

            if (!downloadError && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              const extension = doc.name.split(".").pop() || "pdf";
              archive.append(Buffer.from(arrayBuffer), { name: `insurance/${doc.name}` });
            }
          }
        }
      }
    }

    // Add custom selected documents (photos and other docs are stored in the same bucket they're uploaded to; use persisted bucket when available)
    for (const doc of documents) {
      if (doc.storage_path) {
        try {
          const bucket = (doc as { bucket?: string }).bucket ?? "documents";
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucket)
            .download(doc.storage_path);

          if (!downloadError && fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            archive.append(Buffer.from(arrayBuffer), { name: `documents/${doc.name}` });
          }
        } catch (err) {
          console.error(`Failed to add document ${doc.name}:`, err);
        }
      }
    }

    // Add site contacts if requested
    if (options?.include_site_contacts) {
      const { data: jobDetails } = await supabase
        .from("jobs")
        .select("client_name, location, description, start_date")
        .eq("id", jobId)
        .single();

      if (jobDetails) {
        const contactsText = `Site Contacts - ${jobDetails.client_name}\n\n` +
          `Location: ${jobDetails.location}\n` +
          `Description: ${jobDetails.description || "N/A"}\n` +
          `Start Date: ${jobDetails.start_date || "TBD"}\n`;
        archive.append(contactsText, { name: "site-contacts.txt" });
      }
    }

    // Finalize archive
    await archive.finalize();

    // Wait for all chunks
    await new Promise((resolve) => {
      archive.on("end", resolve);
    });

    // Combine chunks into buffer
    const zipBuffer = Buffer.concat(chunks);

    // Upload to Supabase Storage
    await ensureBucketExists("reports");

    const storagePath = `${organization_id}/permit-packs/${jobId}-${Date.now()}.zip`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Create signed URL (valid for 1 hour)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("reports")
      .createSignedUrl(storagePath, 60 * 60);

    if (signedError) throw signedError;

    res.json({
      data: {
        download_url: signedData?.signedUrl,
        storage_path: storagePath,
      },
    });
  } catch (err: any) {
    console.error("Permit pack generation failed:", err);
    res.status(500).json({ message: "Failed to generate Permit Pack" });
  }
}) as RequestHandler);

