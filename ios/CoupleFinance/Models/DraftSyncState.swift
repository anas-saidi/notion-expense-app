import Foundation

enum DraftSyncState: String, Codable {
    case queued, awaitingRefresh, needsReview
}
