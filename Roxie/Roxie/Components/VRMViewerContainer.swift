import SwiftUI

struct VRMViewerContainer: View {
    @StateObject private var vm = VRMViewerViewModel()

    var body: some View {
        ZStack {
            Color.roxiePink.ignoresSafeArea()
            VRMWebView(
                bridge: vm.bridge,
                onModelReady: { vm.modelBecameReady() },
                onError: { vm.report(error: $0) }
            )
            if !vm.isReady {
                ProgressView().tint(.white)
            }
        }
    }
}

#Preview { VRMViewerContainer() }
