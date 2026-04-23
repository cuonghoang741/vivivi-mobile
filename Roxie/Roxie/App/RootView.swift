import SwiftUI

struct RootView: View {
    @EnvironmentObject private var app: AppViewModel

    var body: some View {
        ZStack {
            switch app.phase {
            case .launching:
                SplashView()
            case .signedOut:
                SignInView()
            case .onboarding:
                OnboardingView()
            case .ready:
                HomeView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: app.phase)
        .task { await app.bootstrap() }
    }
}

#Preview {
    RootView().environmentObject(AppViewModel())
}
