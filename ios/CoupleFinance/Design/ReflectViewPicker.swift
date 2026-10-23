import SwiftUI

struct ReflectViewPicker: View {
    @Binding var selection: String
    var body: some View {
        HStack(spacing: 8) {
            ForEach(["Spending", "Activity"], id: \.self) { option in
                Button { selection = option } label: {
                    Text(option).font(.caption.weight(.semibold)).padding(.horizontal, 14).frame(minHeight: 44)
                        .foregroundStyle(selection == option ? Color(.systemBackground) : .primary)
                        .background(selection == option ? Color.primary : Color(.secondarySystemBackground), in: .capsule)
                }.buttonStyle(.plain).accessibilityAddTraits(selection == option ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }
}
