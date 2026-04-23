import SwiftUI
import AuthenticationServices

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

            VStack(spacing: 24) {
                Spacer()
                Text("Welcome to Roxie")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                Text("Your AI companion, always there.")
                    .font(.system(size: 17))
                    .foregroundStyle(.secondary)
                Spacer()

                SignInWithAppleButton(
                    .signIn,
                    onRequest: vm.configure,
                    onCompletion: { result in
                        Task {
                            if let user = await vm.handle(result: result) {
                                app.signedIn(user)
                            }
                        }
                    }
                )
                .signInWithAppleButtonStyle(.black)
                .frame(height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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
