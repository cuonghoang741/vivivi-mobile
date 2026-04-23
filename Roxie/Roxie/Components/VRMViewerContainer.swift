import SwiftUI

struct VRMViewerContainer: View {
    @StateObject private var vm = VRMViewerViewModel()

    var body: some View {
        ZStack {
            Color.roxiePink.ignoresSafeArea()
            VRMWebView(
                bridge: vm.bridge,
                onInitialReady: { vm.handleInitialReady() },
                onModelLoaded: { vm.handleModelLoaded() },
                onError: { vm.handleError($0) }
            )
            overlay
        }
        .task { await vm.onAppear() }
        .onDisappear { vm.onDisappear() }
    }

    @ViewBuilder
    private var overlay: some View {
        switch vm.state {
        case .loading, .initialReady:
            ProgressView().tint(.white)
        case .modelLoaded:
            EmptyView()
        case .failed(let message):
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.largeTitle)
                    .foregroundStyle(.white)
                Text(message)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 40)
            }
        }
    }
}

#Preview { VRMViewerContainer() }
