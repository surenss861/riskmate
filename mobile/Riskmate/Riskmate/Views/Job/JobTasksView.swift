import SwiftUI

struct JobTasksView: View {
    let jobId: String

    @State private var tasks: [TaskItem] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var showAddSheet = false
    @State private var selectedTask: TaskItem?

    @State private var newTaskTitle = ""
    @State private var newTaskPriority = "medium"
    @State private var newTaskAssignee: String?
    @State private var newTaskDueDate: Date?

    struct TaskItem: Codable, Identifiable {
        let id: String
        let title: String
        let description: String?
        let status: String
        let priority: String
        let assignedUser: String?
        let dueDate: Date?
        let completedAt: Date?
        let sortOrder: Int
    }

    private var sortedTasks: [TaskItem] {
        tasks.sorted { $0.sortOrder < $1.sortOrder }
    }

    private var inProgress: [TaskItem] {
        sortedTasks.filter { $0.status == "in_progress" }
    }

    private var todo: [TaskItem] {
        sortedTasks.filter { $0.status == "todo" }
    }

    private var done: [TaskItem] {
        sortedTasks.filter { $0.status == "done" }
    }

    private var completedCount: Int {
        sortedTasks.filter { $0.status == "done" }.count
    }

    private var completedFraction: Double {
        guard !sortedTasks.isEmpty else { return 0 }
        return Double(completedCount) / Double(sortedTasks.count)
    }

    var body: some View {
        Group {
            if isLoading && tasks.isEmpty {
                VStack(spacing: RMTheme.Spacing.sm) {
                    RMSkeletonList(count: 5)
                }
                .padding(RMTheme.Spacing.pagePadding)
            } else if let loadError = loadError, tasks.isEmpty {
                RMEmptyState(
                    icon: "exclamationmark.triangle",
                    title: "Couldn't load tasks",
                    message: loadError,
                    action: RMEmptyStateAction(
                        title: "Retry",
                        action: { Task { await loadTasks() } }
                    )
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else if tasks.isEmpty {
                RMEmptyState(
                    icon: "checklist",
                    title: "No tasks yet",
                    message: "Add tasks to track work on this job",
                    action: RMEmptyStateAction(
                        title: "Add Task",
                        action: { showAddSheet = true }
                    )
                )
                .padding(RMTheme.Spacing.pagePadding)
            } else {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: RMTheme.Spacing.sm) {
                            Text("\(completedCount) of \(sortedTasks.count) tasks completed")
                                .font(RMTheme.Typography.bodySmall)
                                .foregroundColor(RMTheme.Colors.textSecondary)
                            ProgressView(value: completedFraction)
                                .tint(Color.green)
                        }
                        .padding(.vertical, RMTheme.Spacing.xs)
                    }
                    .listRowBackground(Color.clear)

                    if !inProgress.isEmpty {
                        Section(header: sectionHeader("In Progress")) {
                            ForEach(inProgress) { task in
                                taskRow(task)
                                    .onTapGesture { selectedTask = task }
                            }
                        }
                    }

                    if !todo.isEmpty {
                        Section(header: sectionHeader("To Do")) {
                            ForEach(todo) { task in
                                taskRow(task)
                                    .onTapGesture { selectedTask = task }
                            }
                        }
                    }

                    if !done.isEmpty {
                        Section(header: sectionHeader("Done")) {
                            ForEach(done) { task in
                                taskRow(task)
                                    .onTapGesture { selectedTask = task }
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .sheet(item: $selectedTask) { task in
                    TaskDetailSheet(
                        task: task,
                        jobId: jobId,
                        onDismiss: { selectedTask = nil },
                        onSaved: {
                            await loadTasks()
                            selectedTask = nil
                        }
                    )
                }
            }
        }
        .refreshable {
            await loadTasks()
        }
        .task(id: jobId) {
            await loadTasks()
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundColor(RMTheme.Colors.accent)
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            NavigationStack {
                Form {
                    Section("Task") {
                        TextField("Title", text: $newTaskTitle)
                        Picker("Priority", selection: $newTaskPriority) {
                            Text("Low").tag("low")
                            Text("Medium").tag("medium")
                            Text("High").tag("high")
                            Text("Urgent").tag("urgent")
                        }
                    }
                    Section("Assignment") {
                        TextField("Assignee (optional)", text: Binding(
                            get: { newTaskAssignee ?? "" },
                            set: { newTaskAssignee = $0.isEmpty ? nil : $0 }
                        ))
                    }
                    Section("Due Date") {
                        DatePicker(
                            "Due date",
                            selection: Binding(
                                get: { newTaskDueDate ?? Date() },
                                set: { newTaskDueDate = $0 }
                            ),
                            displayedComponents: .date
                        )
                    }
                }
                .navigationTitle("Add Task")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") {
                            showAddSheet = false
                        }
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Save") {
                            Task { await createTask() }
                        }
                        .disabled(newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(RMTheme.Typography.caption)
            .foregroundColor(RMTheme.Colors.textSecondary)
            .textCase(.uppercase)
    }

    private func taskRow(_ task: TaskItem) -> some View {
        HStack(alignment: .top, spacing: RMTheme.Spacing.sm) {
            Button {
                Task { await completeTask(id: task.id) }
            } label: {
                Image(systemName: task.status == "done" ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(task.status == "done" ? .green : RMTheme.Colors.textTertiary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 4) {
                Text(task.title)
                    .font(RMTheme.Typography.bodySmallBold)
                    .foregroundColor(task.status == "done" ? RMTheme.Colors.textTertiary : RMTheme.Colors.textPrimary)
                    .strikethrough(task.status == "done")

                HStack(spacing: 8) {
                    Circle()
                        .fill(priorityColor(task.priority))
                        .frame(width: 8, height: 8)
                    Text(task.assignedUser ?? "Unassigned")
                        .font(RMTheme.Typography.caption)
                        .foregroundColor(RMTheme.Colors.textSecondary)
                    if let dueDate = task.dueDate {
                        Text(dueDateLabel(dueDate, status: task.status))
                            .font(RMTheme.Typography.caption)
                            .foregroundColor(isOverdue(dueDate: dueDate, status: task.status) ? .red : RMTheme.Colors.textSecondary)
                    }
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button {
                Task { await completeTask(id: task.id) }
            } label: {
                Label("Complete", systemImage: "checkmark")
            }
            .tint(.green)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Task { await deleteTask(id: task.id) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .tint(.red)
        }
        .listRowBackground(Color.clear)
    }

    private func loadTasks() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let fetched = try await APIClient.shared.getTasks(jobId: jobId)
            tasks = fetched.map { item in
                TaskItem(
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    status: item.status,
                    priority: item.priority,
                    assignedUser: item.assignedUser?.fullName ?? item.assignedUser?.email,
                    dueDate: parseDate(item.dueDate),
                    completedAt: parseDate(item.completedAt),
                    sortOrder: item.sortOrder
                )
            }
            loadError = nil
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func createTask() async {
        let trimmed = newTaskTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        do {
            let payload = CreateTaskRequest(
                title: trimmed,
                description: nil,
                assigned_to: newTaskAssignee,
                priority: newTaskPriority,
                due_date: isoDate(newTaskDueDate),
                status: "todo",
                sort_order: nil
            )
            _ = try await APIClient.shared.createTask(jobId: jobId, payload: payload)
            newTaskTitle = ""
            newTaskPriority = "medium"
            newTaskAssignee = nil
            newTaskDueDate = nil
            showAddSheet = false
            await loadTasks()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func completeTask(id: String) async {
        do {
            try await APIClient.shared.completeTask(id: id)
            await loadTasks()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func deleteTask(id: String) async {
        do {
            try await APIClient.shared.deleteTask(id: id)
            await loadTasks()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func priorityColor(_ priority: String) -> Color {
        switch priority {
        case "urgent": return .red
        case "high": return .orange
        case "medium": return .blue
        default: return .gray
        }
    }

    private func dueDateLabel(_ dueDate: Date, status: String) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        let label = formatter.string(from: dueDate)
        if isOverdue(dueDate: dueDate, status: status) {
            return "Overdue • \(label)"
        }
        return "Due \(label)"
    }

    private func isOverdue(dueDate: Date, status: String) -> Bool {
        status != "done" && dueDate < Date()
    }

    private func parseDate(_ value: String?) -> Date? {
        guard let value = value else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let parsed = formatter.date(from: value) {
            return parsed
        }
        return ISO8601DateFormatter().date(from: value)
    }

    private func isoDate(_ date: Date?) -> String? {
        guard let date = date else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

// MARK: - Task Detail / Edit Sheet

private struct TaskDetailSheet: View {
    let task: JobTasksView.TaskItem
    let jobId: String
    let onDismiss: () -> Void
    let onSaved: () async -> Void

    @State private var title: String = ""
    @State private var taskDescription: String = ""
    @State private var priority: String = "medium"
    @State private var dueDate: Date?
    @State private var status: String = "todo"
    @State private var isSaving = false
    @State private var saveError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Task") {
                    TextField("Title", text: $title)
                    TextField("Description", text: $taskDescription, axis: .vertical)
                        .lineLimit(3...6)
                    Picker("Priority", selection: $priority) {
                        Text("Low").tag("low")
                        Text("Medium").tag("medium")
                        Text("High").tag("high")
                        Text("Urgent").tag("urgent")
                    }
                    Picker("Status", selection: $status) {
                        Text("To Do").tag("todo")
                        Text("In Progress").tag("in_progress")
                        Text("Done").tag("done")
                        Text("Cancelled").tag("cancelled")
                    }
                    DatePicker(
                        "Due date",
                        selection: Binding(
                            get: { dueDate ?? Date() },
                            set: { dueDate = $0 }
                        ),
                        displayedComponents: .date
                    )
                }
                if let assignee = task.assignedUser, !assignee.isEmpty {
                    Section("Assignee") {
                        Text(assignee)
                            .foregroundColor(RMTheme.Colors.textSecondary)
                    }
                }
                if saveError != nil {
                    Section {
                        Text(saveError ?? "")
                            .foregroundColor(.red)
                            .font(RMTheme.Typography.caption)
                    }
                }
            }
            .navigationTitle("Task")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                title = task.title
                taskDescription = task.description ?? ""
                priority = task.priority
                dueDate = task.dueDate
                status = task.status
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        onDismiss()
                    }
                    .foregroundColor(RMTheme.Colors.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .disabled(isSaving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        saveError = nil
        defer { isSaving = false }

        do {
            let payload = UpdateTaskRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                description: taskDescription.isEmpty ? nil : taskDescription,
                assigned_to: nil,
                priority: priority,
                due_date: isoDate(dueDate),
                status: status,
                completed_at: status == "done" ? ISO8601DateFormatter().string(from: Date()) : nil,
                sort_order: nil
            )
            _ = try await APIClient.shared.updateTask(id: task.id, payload: payload)
            await onSaved()
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func isoDate(_ date: Date?) -> String? {
        guard let date = date else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        JobTasksView(jobId: "00000000-0000-0000-0000-000000000001")
    }
}
