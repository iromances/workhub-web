export function buildIntakeTodosPath(id: number) {
  return `/intake/${id}/todos`
}

export function buildIntakeTodoPath(id: number, todoId: number) {
  return `/intake/${id}/todos/${todoId}`
}

export function buildIntakeTodoStatusPath(id: number, todoId: number) {
  return `${buildIntakeTodoPath(id, todoId)}/status`
}
