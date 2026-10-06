# Board Buddy

Build a Kanban-style project management app in React + TypeScript. Users sign up, create workspaces, and invite members with roles (owner, editor, viewer). Each workspace has boards, columns, and cards with title, description, assignee, due date, labels. Drag and drop cards between columns with optimistic updates that roll back on failure. Use Supabase with row-level security so users only see workspaces they belong to. Include loading skeletons, empty states, and error toasts. Start with auth, workspaces and roles only. It must have error handling and a super sleek design as well as informative models

**Live app**: https://kanban-joy-44.lovable.app

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
