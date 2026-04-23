import SwiftUI

@MainActor
final class SettingsViewModel: ObservableObject {
    let version: String = {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? ""
        return "\(short) (\(build))"
    }()
}
