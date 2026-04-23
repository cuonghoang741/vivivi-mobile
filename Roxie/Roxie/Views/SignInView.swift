import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var app: AppViewModel
    @StateObject private var vm = SignInViewModel()

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [.roxiePink, .white],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 16) {
                Spacer()
                Text("Welcome to Roxie")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("Your AI companion, always there.")
                    .font(.system(size: 17))
                    .foregroundStyle(.secondary)
                Spacer()

                Button {
                    Task {
                        if let user = await vm.signInWithApple() {
                            app.signedIn(user)
                        }
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "apple.logo")
                            .font(.subheadline)
                        Text("Sign in with Apple")
                            .font(.subheadline.weight(.medium))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .padding(.horizontal, 24)
                }
                .liquidGlassInteractive(tint: .black, in: Capsule())
                .padding(.horizontal, 24)

                Button {
                    Task {
                        if let user = await vm.signInAsGuest() {
                            app.signedIn(user)
                        }
                    }
                } label: {
                    Text("Continue as Guest")
                        .font(.subheadline.weight(.medium))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .padding(.horizontal, 24)
                }
                .liquidGlassInteractive(in: Capsule())
                .padding(.horizontal, 24)
                .padding(.bottom, 32)

                if let error = vm.errorMessage {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.footnote)
                }
            }
            .padding()
            .disabled(vm.isSigningIn)
        }
    }
}

#Preview {
    SignInView().environmentObject(AppViewModel())
}
