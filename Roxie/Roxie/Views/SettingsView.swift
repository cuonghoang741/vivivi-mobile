import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var app: AppViewModel
    @StateObject private var vm = SettingsViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    LabeledContent("Email", value: app.currentUser?.email ?? "—")
                    LabeledContent("User ID", value: app.currentUser?.id ?? "—")
                }
                Section {
                    Button("Sign Out", role: .destructive) {
                        Task {
                            await app.signOut()
                            dismiss()
                        }
                    }
                }
                Section("About") {
                    LabeledContent("Version", value: vm.version)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    SettingsView().environmentObject({
        let a = AppViewModel()
        a.currentUser = .preview
        return a
    }())
}
