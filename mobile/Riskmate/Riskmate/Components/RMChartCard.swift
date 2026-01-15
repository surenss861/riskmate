import SwiftUI
import Charts

/// Premium chart card with RiskMate styling
struct RMChartCard: View {
    let data: [ChartDataPoint]
    @State private var animated = false
    
    var body: some View {
        RMGlassCard {
            VStack(alignment: .leading, spacing: RMTheme.Spacing.md) {
                HStack {
                    Text("Risk Trends")
                        .rmSectionHeader()
                    Spacer()
                    Text("Last 30 days")
                        .rmCaption()
                }
                
                Chart {
                    ForEach(data) { point in
                        LineMark(
                            x: .value("Date", point.date),
                            y: .value("Value", animated ? point.value : 0)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [
                                    RMTheme.Colors.accent,
                                    RMTheme.Colors.accent.opacity(0.3)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                        
                        AreaMark(
                            x: .value("Date", point.date),
                            y: .value("Value", animated ? point.value : 0)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [
                                    RMTheme.Colors.accent.opacity(0.2),
                                    RMTheme.Colors.accent.opacity(0.05)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisGridLine()
                            .foregroundStyle(RMTheme.Colors.border.opacity(0.3))
                        AxisValueLabel()
                            .foregroundStyle(RMTheme.Colors.textTertiary)
                            .font(RMTheme.Typography.captionSmall)
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisGridLine()
                            .foregroundStyle(RMTheme.Colors.border.opacity(0.3))
                        AxisValueLabel()
                            .foregroundStyle(RMTheme.Colors.textTertiary)
                            .font(RMTheme.Typography.captionSmall)
                    }
                }
                .frame(height: 200)
            }
            .padding(RMTheme.Spacing.md)
        }
        .onAppear {
            withAnimation(RMTheme.Animation.springSlow) {
                animated = true
            }
        }
    }
}

// MARK: - Chart Data Models

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
}
