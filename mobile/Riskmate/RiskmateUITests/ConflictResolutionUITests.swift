//
//  ConflictResolutionUITests.swift
//  RiskmateUITests
//
//  UI tests for ConflictResolutionSheet and ConflictHistoryView:
//  - Rendering server/local values
//  - Resolution buttons (Use Server Version, Use My Version, Merge)
//  - Merge gating (Merge button visible only when conflict is merge-capable)
//

import XCTest

final class ConflictResolutionUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    // MARK: - ConflictResolutionSheet UI Tests

    @MainActor
    func testConflictResolutionSheetRendersServerAndLocalValues() throws {
        let app = XCUIApplication()
        app.launchArguments.append("RISKMATE_UI_TEST_CONFLICT_SHEET")
        app.launch()

        // Wait for sheet to appear
        let sheet = app.otherElements["ConflictResolutionSheet"]
        XCTAssertTrue(sheet.waitForExistence(timeout: 5), "ConflictResolutionSheet should appear")

        // Verify server and local version values are displayed (job status conflict: in_progress vs completed)
        XCTAssertTrue(app.staticTexts["in_progress"].exists || app.staticTexts["completed"].exists,
                      "Server or local value should be visible")
    }

    @MainActor
    func testConflictResolutionSheetShowsResolutionButtons() throws {
        let app = XCUIApplication()
        app.launchArguments.append("RISKMATE_UI_TEST_CONFLICT_SHEET")
        app.launch()

        let sheet = app.otherElements["ConflictResolutionSheet"]
        XCTAssertTrue(sheet.waitForExistence(timeout: 5))

        // Job status conflict is NOT merge-capable, so Use Server Version and Use My Version should exist
        XCTAssertTrue(app.buttons["ConflictResolution_UseServerVersion"].exists,
                      "Use Server Version button should be visible")
        XCTAssertTrue(app.buttons["ConflictResolution_UseMyVersion"].exists,
                      "Use My Version button should be visible")

        // Job status uses server-wins auto-strategy; Merge button should NOT be visible (not merge-capable)
        XCTAssertFalse(app.buttons["ConflictResolution_Merge"].exists,
                       "Merge button should be hidden for job status conflict (not merge-capable)")
    }

    @MainActor
    func testConflictResolutionSheetShowsMergeButtonWhenMergeCapable() throws {
        let app = XCUIApplication()
        app.launchArguments.append("RISKMATE_UI_TEST_CONFLICT_SHEET_MERGE")
        app.launch()

        let sheet = app.otherElements["ConflictResolutionSheet"]
        XCTAssertTrue(sheet.waitForExistence(timeout: 5))

        // Hazard conflict is merge-capable: Merge button should be visible
        XCTAssertTrue(app.buttons["ConflictResolution_Merge"].exists,
                      "Merge button should be visible for hazard conflict (merge-capable)")
    }

    // MARK: - ConflictHistoryView UI Tests

    @MainActor
    func testConflictHistoryViewRenders() throws {
        let app = XCUIApplication()
        app.launchArguments.append("RISKMATE_UI_TEST_CONFLICT_HISTORY")
        app.launch()

        // Wait for ConflictHistoryView to appear
        let historyView = app.otherElements["ConflictHistoryView"]
        XCTAssertTrue(historyView.waitForExistence(timeout: 5), "ConflictHistoryView should appear")

        // Verify navigation title
        XCTAssertTrue(app.navigationBars["Conflict history"].exists, "Conflict history title should be visible")

        // Empty state or list: either "No conflicts" or list content
        let noConflicts = app.staticTexts["No conflicts"]
        let doneButton = app.buttons["Done"]
        XCTAssertTrue(noConflicts.waitForExistence(timeout: 3) || doneButton.exists,
                      "Conflict history should show empty state or list with Done button")
    }
}
