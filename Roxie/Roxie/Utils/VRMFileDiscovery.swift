import Foundation

/// Port of RN `src/utils/fileDiscovery.ts`. Currently returns empty lists —
/// all VRM/FBX assets are fetched from remote URLs. If we bundle any, enumerate here.
enum VRMFileDiscovery {
    static func fileListJSON() -> String {
        #"{"vrmFiles":[],"fbxFiles":[]}"#
    }
}
