import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var app: AppViewModel
    @StateObject private var vm = HomeViewModel()

    var body: some View {
        ZStack {
            VRMViewerContainer()
                .ignoresSafeArea()

            VStack {
                topBar
                Spacer()
                bottomBar
            }
        }
        .sheet(isPresented: $vm.showSettings) {
            SettingsView()
        }
    }

    private var topBar: some View {
        HStack {
            Button {
                vm.openSettings()
            } label: {
                Image(systemName: "gearshape.fill")
                    .font(.title3)
                    .padding(12)
            }
            .liquidGlassInteractive(in: Circle())

            Spacer()
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    private var bottomBar: some View {
        HStack(spacing: 12) {
            actionButton(symbol: "message.fill", label: "Chat", action: vm.tapChat)
            actionButton(symbol: "phone.fill", label: "Call", action: vm.tapCall)
            actionButton(symbol: "gift.fill", label: "Gift", action: vm.tapGift)
        }
        .padding(.horizontal)
        .padding(.bottom, 16)
    }

    private func actionButton(symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: symbol).font(.title3)
                Text(label).font(.caption)
            }
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(.plain)
        .liquidGlass(in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

#Preview {
    HomeView().environmentObject({
        let a = AppViewModel()
        a.currentUser = .preview
        a.phase = .ready
        return a
    }())
}
