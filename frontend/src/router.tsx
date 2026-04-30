import { createBrowserRouter } from 'react-router-dom'

import { RootLayout } from './layouts/RootLayout'
import { GamePage } from './pages/GamePage'
import { AdminPage } from './pages/AdminPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { SubmitPromptPage } from './pages/SubmitPromptPage'
import { NotFoundPage } from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <GamePage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'submit', element: <SubmitPromptPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
