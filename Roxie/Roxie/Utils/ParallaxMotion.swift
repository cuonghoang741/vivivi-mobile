import CoreMotion
import Foundation

/// Reads device motion and forwards normalized (dx, dy) to a callback at ~45 fps.
/// Use from an `@MainActor` owner via `start(onSample:)` and stop in `deinit` or view disappear.
@MainActor
final class ParallaxMotion {
    private let manager = CMMotionManager()
    private let queue = OperationQueue()
    private var running = false

    init() {
        queue.qualityOfService = .userInteractive
        manager.deviceMotionUpdateInterval = 1.0 / 45.0
    }

    func start(onSample: @escaping @MainActor (_ dx: Double, _ dy: Double) -> Void) {
        guard manager.isDeviceMotionAvailable, !running else { return }
        running = true
        manager.startDeviceMotionUpdates(to: queue) { motion, _ in
            guard let motion else { return }
            // Gravity gives a stable "tilt" vector independent of rotation speed.
            // Map roll (x axis) → dx, pitch (y axis) → dy, in [-1, 1].
            let dx = max(-1, min(1, motion.gravity.x))
            let dy = max(-1, min(1, motion.gravity.y))
            Task { @MainActor in onSample(dx, dy) }
        }
    }

    func stop() {
        guard running else { return }
        running = false
        manager.stopDeviceMotionUpdates()
    }
}
