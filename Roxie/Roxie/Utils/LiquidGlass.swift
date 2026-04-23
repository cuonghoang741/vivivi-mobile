import SwiftUI

/// Centralized liquid-glass surface.
/// iOS 26 uses the real `.glassEffect`; earlier versions fall back to `.ultraThinMaterial`.
extension View {
    @ViewBuilder
    func liquidGlass(
        tint: Color? = nil,
        in shape: some Shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
    ) -> some View {
        if #available(iOS 26.0, *) {
            if let tint {
                self.glassEffect(.regular.tint(tint), in: shape)
            } else {
                self.glassEffect(.regular, in: shape)
            }
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .overlay(shape.fill((tint ?? .clear).opacity(0.25)))
        }
    }

    @ViewBuilder
    func liquidGlassInteractive(
        tint: Color? = nil,
        in shape: some Shape = Capsule()
    ) -> some View {
        if #available(iOS 26.0, *) {
            if let tint {
                self.glassEffect(.regular.tint(tint).interactive(), in: shape)
            } else {
                self.glassEffect(.regular.interactive(), in: shape)
            }
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .overlay(shape.fill((tint ?? .clear).opacity(0.6)))
        }
    }
}
