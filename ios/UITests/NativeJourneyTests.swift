import XCTest

@MainActor final class NativeJourneyTests: XCTestCase {
    func testSampleHouseholdUsesNativeBudgetPlannerAndInsights() throws {
        let app = XCUIApplication()
        // Ignore any simulator connection left by manual testing, without deleting it.
        app.launchArguments = ["-financeServer", ""]
        app.launch()
        let explore = app.buttons["Explore a sample household"]
        XCTAssertTrue(explore.waitForExistence(timeout: 10))
        explore.tap()
        XCTAssertTrue(app.staticTexts["Sample household"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.webViews.count, 0)
        capture(app, "Home")
        app.buttons["Settings"].tap()
        XCTAssertTrue(app.staticTexts["Notifications"].waitForExistence(timeout: 5))
        capture(app, "Notification Settings")
        app.buttons["Done"].tap()

        app.buttons["tab-budget"].tap()
        let planner = app.buttons["Plan the month"]
        XCTAssertTrue(planner.waitForExistence(timeout: 5))
        capture(app, "Budget")
        planner.tap()
        XCTAssertTrue(app.textFields["Groceries monthly assignment in MAD"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.webViews.count, 0)
        app.buttons["Cancel"].tap()

        app.buttons["tab-reflect"].tap()
        XCTAssertTrue(app.staticTexts["Where it went"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.webViews.count, 0)
        capture(app, "Reflect")
        app.buttons["tab-home"].tap()
        app.buttons["Exit preview"].tap()
        XCTAssertTrue(explore.waitForExistence(timeout: 5))
    }
    func testBillNotificationsRequireOptInAndDeliverGenericTest() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--sample-household"]
        app.launch()
        app.buttons["Settings"].tap()
        let existingToggle = app.switches["Bill reminders"]
        if existingToggle.exists && existingToggle.value as? String == "1" {
            existingToggle.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        }
        let enable = app.buttons["Enable bill reminders"]
        XCTAssertTrue(enable.waitForExistence(timeout: 5))
        enable.tap()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.buttons["Allow"]
        if allow.waitForExistence(timeout: 5) { allow.tap() }
        let test = app.buttons["Send a test notification"]
        XCTAssertTrue(test.waitForExistence(timeout: 5))
        test.tap()
        XCTAssertTrue(springboard.staticTexts["Notifications are ready"].waitForExistence(timeout: 12))
        capture(app, "Test notification")
        let toggle = app.switches["Bill reminders"]
        if toggle.exists && toggle.value as? String == "1" {
            toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        }
        XCTAssertTrue(enable.waitForExistence(timeout: 5))
    }

    func testDailyReminderIsIndependentOfBillReminders() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--sample-household"]
        app.launch()
        app.buttons["Settings"].tap()
        let enable = app.buttons["Enable daily transaction reminder"]
        XCTAssertTrue(enable.waitForExistence(timeout: 5))
        enable.tap()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        if springboard.buttons["Allow"].waitForExistence(timeout: 2) { springboard.buttons["Allow"].tap() }
        let toggle = app.switches["Daily transaction reminder"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Enable bill reminders"].exists)
        capture(app, "Daily reminder settings")
        if toggle.value as? String == "1" {
            toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
        }
        XCTAssertTrue(enable.waitForExistence(timeout: 5))
    }

    func testPersonalJointDebtIsIncludedInExistingDue() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--sample-household"]
        app.launch()
        let due = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Anas wallet.")).firstMatch
        XCTAssertTrue(due.waitForExistence(timeout: 5))
        let expectedDue = try XCTUnwrap(Decimal(string: "903.45")).formatted()
        XCTAssertTrue(due.label.contains("\(expectedDue) MAD due"), due.label)
        XCTAssertFalse(app.staticTexts["Anas owes Joint"].exists)
        XCTAssertEqual(app.webViews.count, 0)
        capture(app, "Personal spending included in due")
    }

    func testOfflineEditIsSavedLocallyAndListedForWiFiSync() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--offline-household"]
        app.launch()
        let transaction = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Market groceries")).firstMatch
        XCTAssertTrue(transaction.waitForExistence(timeout: 8))
        app.swipeUp()
        app.swipeUp()
        capture(app, "Offline history before editing")
        transaction.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.1)).tap()
        XCTAssertTrue(app.buttons["Edit transaction"].waitForExistence(timeout: 5))
        app.buttons["Edit transaction"].tap()
        let description = app.textFields["What was it for?"]
        XCTAssertTrue(description.waitForExistence(timeout: 5))
        description.tap()
        description.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "Market groceries".count) + "Offline edited groceries")
        let save = app.buttons["Save offline"]
        if !save.isHittable { app.swipeUp() }
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()
        let edited = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Offline edited groceries")).firstMatch
        XCTAssertTrue(edited.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["1 change waiting for Wi-Fi"].exists)
        XCTAssertFalse(app.alerts["Could not complete the action"].exists)
        capture(app, "Offline edit waiting for Wi-Fi")
    }

    private func capture(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
