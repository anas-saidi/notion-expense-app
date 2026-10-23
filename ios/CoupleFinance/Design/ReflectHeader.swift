import SwiftUI

struct ReflectHeader: View {
    @Binding var selection: String
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    var body: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 12) {
                Text("Reflect").font(.title2.weight(.semibold))
                ReflectViewPicker(selection: $selection)
            }
        } else {
            HStack {
                Text("Reflect").font(.title2.weight(.semibold))
                Spacer()
                ReflectViewPicker(selection: $selection)
            }
        }
    }
}
