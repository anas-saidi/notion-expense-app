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

    func testPersonalJointDebtIsVisibleInNativeHome() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--sample-household"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Anas owes Joint"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["For personal spending. Included in the amount due. Transfer from the personal account to Joint to repay."].exists)
        XCTAssertEqual(app.webViews.count, 0)
        capture(app, "Personal spending owed to Joint")
    }

    private func capture(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
