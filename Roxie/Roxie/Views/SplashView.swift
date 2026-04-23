import SwiftUI

struct SplashView: View {
    var body: some View {
        ZStack {
            Color.roxiePink.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "sparkles")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 96, height: 96)
                    .foregroundStyle(.white)
                Text("Roxie")
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                ProgressView()
                    .tint(.white)
                    .padding(.top, 24)
            }
        }
    }
}

extension Color {
    static let roxiePink = Color(red: 1.0, green: 0.753, blue: 0.796) // #FFC0CB
}

#Preview { SplashView() }
