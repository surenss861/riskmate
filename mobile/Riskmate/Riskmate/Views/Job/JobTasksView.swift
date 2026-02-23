import SwiftUI

struct JobTasksView: View {
    let jobId: String
    /// Job title (e.g. client name) for notification payloads. Defaults to "Job" when nil.
    var jobTitle: String? = nil

    @State private var tasks: [TaskItem] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var showAddSheet = false
    @State private var showTemplateSheet = false
    @State private var selectedTask: TaskItem?

    @State private var newTaskTitle = ""
    @State private var newTaskPriority = "medium"
    @State private var newTaskAssigneeId: String?
    @State private var newTaskDueDate: Date?
    @State private var addSheetMembers: [TeamMember] = []

    struct TaskItem: Codable, Identifiable {
        let id: String
        let title: String
        let description: String?
        let status: String
        let priority: String
        let assignedUser: String?
        let assignedUserId: String?
        let dueDate: Date?
        let completedAt: Date?
        let sortOrder: Int
    }

    private var sortedTasks: [TaskItem] {
        tasks.sorted { $0.sortOrder < $1.sortOrder }
    }

    /// Tasks that count toward progress: todo, in_progress, done. Cancelled are excluded from counts and progress bar.
    private var activeTasks: [TaskItem] {
        sortedTasks.filter { ["todo", "in_progress", "done"].contains($0.status) }
    }

    private var inProgress: [TaskItem] {
        sortedTasks.filter { $0.status == "in_progress" }
    }

    private var todo: [TaskItem] {
        sortedTasks.filter { $0.status == "todo" }
    }

    private var done: [TaskItem] {
        sortedTasks.filter { $0.status == "done" }
    }

    private var cancelled: [TaskItem] {
        sortedTasks.filter { $0.status == "cancelled" }
    }

    private var completedCount: Int {
        activeTasks.filter { $0.status == "done" }.count
    }

    private var completedFraction: Double {
        guard !activeTasks.isEmpty else { return 0 }
        return Double(completedCount) / Double(activeTasks.count)
    }

    var body: some View {
        Group {
            if isLoading && tasks.isEmpty {
                VStack(spacing: RMTheme.Spacing.sm) {
                    RMSkeletonList(count: 5)
                }
                .padding(RMTheme.Spacing.pagePadding)
            } else if let loadError = loadError, tasks.isEmpty {
                RMEmptyState(
                    icon: "exclamationmark.triangle",
                    title: "Couldn't load tasks",
                    message: loadError,
                    action: RMEmptyStateAction(
                        title: "Retry",
                        action: { Task { await loadTasks() } }
                    )
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else if tasks.isEmpty {
                RMEmptyState(
                    icon: "checklist",
                    title: "No tasks yet",
                    message: "Add tasks to track work on this job",
                    action: RMEmptyStateAction(
                        title: "Add Task",
                        action: { showAddSheet = true }
                    )
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("\(completedCount) of \(activeTasks.count) tasks completed")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                            ProgressView(value: completedFraction)
                                .tint(Color.green)
                        }
                        .padding(.vertical, RMTheme.Spacing.xs)
                    }
                    .listRowBackground(Color.clear)

                    if !inProgress.isEmpty {
                        Section(header: sectionHeader("In Progress")) {
                            ForEach(inProgress) { task in
                                taskRow(task)
                                    .onTapGesture { selectedTask = task }
                            }
                        }
                    }

                    if !todo.isEmpty {
                        Section(header: sectionHeader("To Do")) {
                            ForEach(todo) { task in
                                taskRow(task)
                                    .onTapGesture { selectedTask = task }
                            }
                        }
                    }

                    if !done.isEmpty {
                        Section(header: sectionHeader("Done")) {
                            ForEach(done) { task in
                                taskRow(task)
                                    .onTapGesture { selectedTask = task }
                            }
                        }
                    }

                    if !cancelled.isEmpty {
                        Section(header: sectionHeader("Cancelled")) {
                            ForEach(cancelled) { task in
                                taskRow(task)
                                    .onTapGesture { selectedTask = task }
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .sheet(item: $selectedTask) { task in
                    TaskDetailSheet(
                        task: task,
                        jobId: jobId,
                        jobTitle: jobTitle ?? "Job",
                        onDismiss: { selectedTask = nil },
                        onSaved: {
                            await loadTasks()
                            selectedTask = nil
                        }
                    )
                }
            }
        }
        .refreshable {
            await loadTasks()
        }
        .task(id: jobId) {
            await loadTasks()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showAddSheet = true
                    } label: {
                        Label("Add Task", systemImage: "plus")
                    }
                    Button {
                        showTemplateSheet = true
                    } label: {
                        Label("From template", systemImage: "list.bullet.rectangle")
                    }
                } label: {
                    Image(systemName: "plus")
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
        .sheet(isPresented: $showTemplateSheet) {
            TaskTemplatesSheet(
                jobId: jobId,
                onDismiss: { showTemplateSheet = false },
                onApply: { await applyTemplate($0) }
            )
        }
        .sheet(isPresented: $showAddSheet) {
            NavigationStack {
                Form {
                    Section("Task") {
                        TextField("Title", text: $newTaskTitle)
                        Picker("Priority", selection: $newTaskPriority) {
                            Text("Low").tag("low")
                            Text("Medium").tag("medium")
                            Text("High").tag("high")
                            Text("Urgent").tag("urgent")
                        }
                    }
                    Section("Assignment") {
                        Picker("Assignee", selection: $newTaskAssigneeId) {
                            Text("Unassigned").tag(String?.none)
                            ForEach(addSheetMembers) { member in
                                Text(member.fullName ?? member.email).tag(String?(member.id))
                            }
                        }
                    }
                    Section("Due Date") {
                        DatePicker(
                            "Due date",
                            selection: Binding(
                                get: { newTaskDueDate ?? Date() },
                                set: { newTaskDueDate = $0 }
                            ),
                            displayedComponents: .date
                        )
                    }
                }
                .onAppear {
                    Task {
                        do {
                            let team = try await APIClient.shared.getTeam()
                            addSheetMembers = team.members
                        } catch {
                            addSheetMembers = []
                        }
                    }
                }
                .onDisappear {
                    newTaskTitle = ""
                    newTaskPriority = "medium"
                    newTaskAssigneeId = nil
                    newTaskDueDate = nil
                }
                .navigationTitle("Add Task")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") {
                            showAddSheet = false
                        }
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Save") {
                            Task { await createTask() }
                        }
                        .disabled(newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(RMTheme.Typography.caption)
            .foregroundColor(RMTheme.Colors.textSecondary)
            .textCase(.uppercase)
    }

    private func taskRow(_ task: TaskItem) -> some View {
        let isCancelled = task.status == "cancelled"
        return HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
            if isCancelled {
                Image(systemName: "circle")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(RMTheme.Colors.textTertiary.opacity(0.5))
            } else {
                Button {
                    guard task.status != "done" else { return }
                    Task { await completeTask(id: task.id) }
                } label: {
                    Image(systemName: task.status == "done" ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(task.status == "done" ? .green : RMTheme.Colors.textTertiary)
                }
                .buttonStyle(.plain)
                .disabled(task.status == "done")
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(task.status == "done" ? RMTheme.Colors.textTertiary : RMTheme.Colors.textPrimary)
                    .strikethrough(task.status == "done")

                HStack(spacing: 8) {
                    Circle()
                        .fill(priorityColor(task.priority))
                        .frame(width: 8, height: 8)
                    Text(task.assignedUser ?? "Unassigned")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    if let dueDate = task.dueDate {
                        Text(dueDateLabel(dueDate, status: task.status))
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(isOverdue(dueDate: dueDate, status: task.status) ? .red : RMTheme.Colors.textSecondary)
                    }
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if task.status == "cancelled" {
                Button {
                    Task { await reopenTask(id: task.id) }
                } label: {
                    Label("Reopen", systemImage: "arrow.uturn.backward")
                }
                .tint(.blue)
            } else if task.status != "done" {
                Button {
                    Task { await completeTask(id: task.id) }
                } label: {
                    Label("Complete", systemImage: "checkmark")
                }
                .tint(.green)
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Task { await deleteTask(id: task.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .tint(.red)
        }
        .listRowBackground(Color.clear)
    }

    private func loadTasks() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let fetched = try await APIClient.shared.getTasks(jobId: jobId)
            tasks = fetched.map { item in
                TaskItem(
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    status: item.status,
                    priority: item.priority,
                    assignedUser: item.assignedUser?.fullName ?? item.assignedUser?.email,
                    assignedUserId: item.assignedUser?.id,
                    dueDate: parseDate(item.dueDate),
                    completedAt: parseDate(item.completedAt),
                    sortOrder: item.sortOrder
                )
            }
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func createTask() async {
        let trimmed = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        do {
            let payload = CreateTaskRequest(
                title: trimmed,
                description: nil,
                assigned_to: newTaskAssigneeId,
                priority: newTaskPriority,
                due_date: isoDate(newTaskDueDate),
                status: "todo",
                sort_order: nil
            )
            let created = try await APIClient.shared.createTask(jobId: jobId, payload: payload)
            newTaskTitle = ""
            newTaskPriority = "medium"
            newTaskAssigneeId = nil
            newTaskDueDate = nil
            showAddSheet = false
            await loadTasks()

            let titleForNotify = jobTitle ?? "Job"
            if let assigneeId = newTaskAssigneeId {
                Task {
                    do {
                        try await APIClient.shared.notifyTaskAssigned(userId: assigneeId, taskId: created.id, taskTitle: created.title, jobId: jobId, jobTitle: titleForNotify)
                    } catch {
                        ToastCenter.shared.show("Assignee notification failed", systemImage: "exclamationmark.triangle", style: .error)
                    }
                }
            }
            if newTaskDueDate != nil, isDueDateInAlertWindow(newTaskDueDate!) {
                Task {
                    do {
                        try await APIClient.shared.scheduleTaskReminder(taskId: created.id)
                        ToastCenter.shared.show("Reminders scheduled for this task", systemImage: "bell.badge", style: .success)
                    } catch { /* non-fatal */ }
                }
            }
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func completeTask(id: String) async {
        do {
            try await APIClient.shared.completeTask(id: id)
            await loadTasks()
            ToastCenter.shared.show("Task completed", systemImage: "checkmark.circle.fill", style: .success)
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func deleteTask(id: String) async {
        do {
            try await APIClient.shared.deleteTask(id: id)
            await loadTasks()
        } catch {
            loadError = error.localizedDescription
        }
    }

    /// Reopen a cancelled task by setting status back to "todo" (does not call completeTask).
    private func reopenTask(id: String) async {
        do {
            let payload = UpdateTaskRequest(
                title: nil,
                description: nil,
                assigned_to: nil,
                priority: nil,
                due_date: nil,
                status: "todo",
                completed_at: nil,
                sort_order: nil
            )
            _ = try await APIClient.shared.updateTask(id: id, payload: payload)
            await loadTasks()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func priorityColor(_ priority: String) -> Color {
        switch priority {
        case "urgent": return .red
        case "high": return .orange
        case "medium": return .blue
        default: return .gray
        }
    }

    private func dueDateLabel(_ dueDate: Date, status: String) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        let label = formatter.string(from: dueDate)
        if isOverdue(dueDate: dueDate, status: status) {
            return "Overdue • \(label)"
        }
        return "Due \(label)"
    }

    private func isOverdue(dueDate: Date, status: String) -> Bool {
        status != "done" && dueDate < Date()
    }

    /// Due date is within the next 24 hours or already past (alert window for scheduling reminders).
    private func isDueDateInAlertWindow(_ date: Date?) -> Bool {
        guard let date = date else { return false }
        let due = date.timeIntervalSince1970
        let now = Date().timeIntervalSince1970
        let window: TimeInterval = 24 * 60 * 60
        return due <= now + window
    }

    /// Apply a task template: create tasks with preserved sort_order, then refresh list.
    private func applyTemplate(_ template: TaskTemplate) async {
        let items = template.tasks ?? []
        guard !items.isEmpty else {
            showTemplateSheet = false
            return
        }
        let offset = tasks.isEmpty ? 0 : (tasks.map(\.sortOrder).max() ?? -1) + 1
        var failed = 0
        for (index, item) in items.enumerated() {
            let sortOrder = offset + (item.sort_order ?? index)
            let payload = CreateTaskRequest(
                title: item.title ?? "Untitled task",
                description: item.description,
                assigned_to: item.assigned_to,
                priority: item.priority ?? "medium",
                due_date: item.due_date,
                status: item.status ?? "todo",
                sort_order: sortOrder
            )
            do {
                _ = try await APIClient.shared.createTask(jobId: jobId, payload: payload)
            } catch {
                failed += 1
            }
        }
        showTemplateSheet = false
        await loadTasks()
        if failed > 0 {
            ToastCenter.shared.show(
                failed == items.count ? "Could not create tasks" : "\(failed) of \(items.count) tasks could not be created",
                systemImage: "exclamationmark.triangle",
                style: .error
            )
        } else if items.count > 0 {
            ToastCenter.shared.show("Template applied", systemImage: "checkmark.circle.fill", style: .success)
        }
    }

    private func parseDate(_ value: String?) -> Date? {
        guard let value = value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let parsed = formatter.date(from: value) {
            return parsed
        }
        return ISO8601DateFormatter().date(from: value)
    }

    private func isoDate(_ date: Date?) -> String? {
        guard let date = date else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

// MARK: - Task Detail / Edit Sheet

private struct TaskDetailSheet: View {
    let task: JobTasksView.TaskItem
    let jobId: String
    let jobTitle: String
    let onDismiss: () -> Void
    let onSaved: () async -> Void

    @State private var title: String = ""
    @State private var taskDescription: String = ""
    @State private var priority: String = "medium"
    @State private var dueDate: Date?
    @State private var status: String = "todo"
    @State private var assignedToId: String?
    @State private var detailSheetMembers: [TeamMember] = []
    @State private var isSaving = false
    @State private var saveError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Title", text: $title)
                    TextField("Description", text: $taskDescription, axis: .vertical)
                        .lineLimit(3...6)
                    Picker("Priority", selection: $priority) {
                        Text("Low").tag("low")
                        Text("Medium").tag("medium")
                        Text("High").tag("high")
                        Text("Urgent").tag("urgent")
                    }
                    Picker("Status", selection: $status) {
                        Text("To Do").tag("todo")
                        Text("In Progress").tag("in_progress")
                        Text("Done").tag("done")
                        Text("Cancelled").tag("cancelled")
                    }
                    DatePicker(
                        "Due date",
                        selection: Binding(
                            get: { dueDate ?? Date() },
                            set: { dueDate = $0 }
                        ),
                        displayedComponents: .date
                    )
                }
                Section("Assignment") {
                    Picker("Assignee", selection: $assignedToId) {
                        Text("Unassigned").tag(String?.none)
                        ForEach(detailSheetMembers) { member in
                            Text(member.fullName ?? member.email).tag(String?(member.id))
                        }
                    }
                }
                if saveError != nil {
                    Section {
                        Text(saveError ?? "")
                            .foregroundColor(.red)
                            .font(RMTheme.Typography.caption)
                    }
                }
            }
            .navigationTitle("Task")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                title = task.title
                taskDescription = task.description ?? ""
                priority = task.priority
                dueDate = task.dueDate
                status = task.status
                assignedToId = task.assignedUserId
                Task {
                    do {
                        let team = try await APIClient.shared.getTeam()
                        detailSheetMembers = team.members
                    } catch {
                        detailSheetMembers = []
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        onDismiss()
                    }
                    .foregroundColor(RMTheme.Colors.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .disabled(isSaving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        saveError = nil
        defer { isSaving = false }

        let completedAtValue: String?
        if status == "done" {
            if task.status != "done" {
                completedAtValue = ISO8601DateFormatter().string(from: Date())
            } else {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                completedAtValue = task.completedAt.map { formatter.string(from: $0) }
                    ?? ISO8601DateFormatter().string(from: Date())
            }
        } else {
            completedAtValue = nil
        }

        do {
            let payload = UpdateTaskRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                description: taskDescription.isEmpty ? nil : taskDescription,
                assigned_to: assignedToId,
                priority: priority,
                due_date: isoDate(dueDate),
                status: status,
                completed_at: completedAtValue,
                sort_order: nil
            )
            _ = try await APIClient.shared.updateTask(id: task.id, payload: payload)
            await onSaved()

            if let assigneeId = assignedToId, assigneeId != task.assignedUserId {
                Task {
                    do {
                        try await APIClient.shared.notifyTaskAssigned(userId: assigneeId, taskId: task.id, taskTitle: title.trimmingCharacters(in: .whitespacesAndNewlines), jobId: jobId, jobTitle: jobTitle)
                    } catch {
                        ToastCenter.shared.show("Assignee notification failed", systemImage: "exclamationmark.triangle", style: .error)
                    }
                }
            }
            if let due = dueDate, isDueDateInAlertWindow(due) {
                Task {
                    do {
                        try await APIClient.shared.scheduleTaskReminder(taskId: task.id)
                        ToastCenter.shared.show("Reminders scheduled for this task", systemImage: "bell.badge", style: .success)
                    } catch { /* non-fatal */ }
                }
            }
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func isDueDateInAlertWindow(_ date: Date?) -> Bool {
        guard let date = date else { return false }
        let due = date.timeIntervalSince1970
        let now = Date().timeIntervalSince1970
        let window: TimeInterval = 24 * 60 * 60
        return due <= now + window
    }

    private func isoDate(_ date: Date?) -> String? {
        guard let date = date else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

// MARK: - Task Templates Sheet

private struct TaskTemplatesSheet: View {
    let jobId: String
    let onDismiss: () -> Void
    let onApply: (TaskTemplate) async -> Void

    @State private var templates: [TaskTemplate] = []
    @State private var isLoading = true
    @State private var loadError: String?

    private static let defaultTemplates: [TaskTemplate] = [
        TaskTemplate(
            id: "default-electrical-inspection",
            name: "Electrical Inspection",
            tasks: [
                TemplateTaskItem(title: "Isolate power", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 0),
                TemplateTaskItem(title: "Test circuits", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 1),
                TemplateTaskItem(title: "Document findings", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 2),
                TemplateTaskItem(title: "Sign off", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 3),
            ],
            jobType: "electrical",
            organizationId: nil
        ),
        TaskTemplate(
            id: "default-plumbing-repair",
            name: "Plumbing Repair",
            tasks: [
                TemplateTaskItem(title: "Shut off water", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 0),
                TemplateTaskItem(title: "Inspect pipes", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 1),
                TemplateTaskItem(title: "Complete repair", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 2),
                TemplateTaskItem(title: "Test pressure", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 3),
            ],
            jobType: "plumbing",
            organizationId: nil
        ),
        TaskTemplate(
            id: "default-safety-audit",
            name: "Safety Audit",
            tasks: [
                TemplateTaskItem(title: "Review hazards", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 0),
                TemplateTaskItem(title: "Check controls", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 1),
                TemplateTaskItem(title: "Verify PPE", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 2),
                TemplateTaskItem(title: "Complete checklist", description: nil, assigned_to: nil, priority: nil, due_date: nil, status: nil, sort_order: 3),
            ],
            jobType: "safety",
            organizationId: nil
        ),
    ]

    private static let defaultTemplateNames: Set<String> = ["Electrical Inspection", "Plumbing Repair", "Safety Audit"]

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading templates…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError = loadError {
                    VStack(spacing: RMTheme.Spacing.sm) {
                        Text(loadError)
                            .font(RMTheme.Typography.bodySmall)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                        Button("Retry") {
                            Task { await loadTemplates() }
                        }
                        .foregroundColor(RMTheme.Colors.accent)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if templates.isEmpty {
                    Text("No templates yet")
                        .font(RMTheme.Typography.bodySmall)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(templates) { template in
                            Button {
                                Task {
                                    await onApply(template)
                                    onDismiss()
                                }
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(template.name)
                                            .font(RMTheme.Typography.bodySmallBold)
                                            .foregroundColor(RMTheme.Colors.textPrimary)
                                        Text("\(template.tasks?.count ?? 0) tasks")
                                            .font(RMTheme.Typography.caption)
                                            .foregroundColor(RMTheme.Colors.textSecondary)
                                    }
                                    if let jobType = template.jobType, !jobType.isEmpty {
                                        Text(jobType)
                                            .font(RMTheme.Typography.caption)
                                            .foregroundColor(RMTheme.Colors.textTertiary)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundColor(RMTheme.Colors.textTertiary)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Task Templates")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        onDismiss()
                    }
                    .foregroundColor(RMTheme.Colors.textSecondary)
                }
            }
            .task {
                await loadTemplates()
            }
        }
    }

    private func loadTemplates() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            let fromApi = try await APIClient.shared.getTaskTemplates()
            let orgOnly = fromApi.filter { !Self.defaultTemplateNames.contains($0.name) }
            templates = Self.defaultTemplates + orgOnly
        } catch {
            loadError = error.localizedDescription
            templates = Self.defaultTemplates
        }
    }
}

#Preview {
    NavigationStack {
        JobTasksView(jobId: "00000000-0000-0000-0000-000000000001")
    }
}
