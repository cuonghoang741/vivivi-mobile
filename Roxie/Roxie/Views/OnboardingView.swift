import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var app: AppViewModel
    @StateObject private var vm = OnboardingViewModel()

    var body: some View {
        VStack {
            TabView(selection: $vm.step) {
                ForEach(vm.pages.indices, id: \.self) { index in
                    let page = vm.pages[index]
                    VStack(spacing: 20) {
                        Image(systemName: page.symbol)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 120, height: 120)
                            .foregroundStyle(Color.roxiePink)
                        Text(page.title)
                            .font(.title.bold())
                        Text(page.body)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 32)
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button {
                withAnimation {
                    vm.advance(onFinish: { app.finishedOnboarding() })
                }
            } label: {
                Text(vm.ctaLabel)
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 54)
            }
            .background(Color.roxiePink, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .foregroundStyle(.white)
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }
}

#Preview {
    OnboardingView().environmentObject(AppViewModel())
}
