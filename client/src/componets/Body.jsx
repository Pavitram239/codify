import React from 'react';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from './Layout';
import Login from './Login';
import Browse from './Browse';
import Student from './Student';
import MakeContest from './Contest/MakeContest';
import CreateContest from './Contest/CreateContest';
import MakeProblem from './Problem/MakeProblem';
import ProblemForm from './Problem/ProblemForm';
import ProblemShow from './Problem/ProblemShow';
import NotFoundError from './NotFoundError';
import Contest from './Contest/Contest';
import Profile from './Profile/Profile';
import AdminPage from './Admin/AdminPage';
import Dashboard from './Problem/Dashboard';
import History from './History';
import FacultyPage from './Faculty/FacultyPage';
import StudentRegister from './Faculty/StudentRegister';
import FacultyRegister from './Faculty/FacultyRegister';
import AdminRegister from './Admin/AdminRegister';
import StudentList from './Admin/StudentList';
import AssignProblem from './Problem/AssignProblem';
import AssignedStudents from './Problem/AssignedStudents';
import StudentInfo from './Admin/StudentInfo';
import Details from './Problem/Details';
import Support from './Support';
import AssignedContest from './Contest/AssignedContest';
import UnAssignContest from './Contest/UnAssignContest';
import Duplicate from './Duplicate';
import ContestDashboard from './Contest/ContestDashboard';
import SessionManagement from './Admin/SessionManagement';

const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "/", element: <Login /> },
      { path: "/browse", element: <Browse /> },
      { path: "/support", element: <Support /> },
      { path: "/student", element: <Student /> },
      { path: "/make-contest", element: <MakeContest /> },
      { path: "/create-contest", element: <CreateContest /> },
      { path: "/create-contest/:id", element: <CreateContest /> },
      { path: "/contests/:id", element: <Contest /> },
      { path: "/make-problem", element: <MakeProblem /> },
      { path: "/problems", element: <MakeProblem /> },
      { path: "/pending-requests", element: <AdminPage /> },
      { path: "/faculty-section", element: <FacultyPage /> },
      { path: "/problem-form", element: <ProblemForm /> },
      { path: "/problem-form/:id", element: <ProblemForm /> },
      { path: "/problems/:id", element: <ProblemShow /> },
      { path: "/profile", element: <Profile /> },
      { path: "/dashboard/:problemId", element: <Dashboard /> },
      { path: "/history", element: <History /> },
      { path: "*", element: <NotFoundError /> },
      { path: "/add-student-using-file", element: <StudentRegister /> },
      { path: "/registerStudent", element: <FacultyRegister /> },
      { path: "/registerFaculty", element: <AdminRegister /> },
      { path:"/students/:facultyId", element: <StudentList /> },
      { path:"/assignProblem/:problemId", element: <AssignProblem /> },
      { path:"/assignedStudents/:problemId", element: <AssignedStudents /> },
      { path:"/studentinformation", element: <StudentInfo /> },
      { path:"/submissions/:submissionId", element:<Details />},
      { path:"/assignContestToStudents/:contestId", element:<UnAssignContest />},
      { path:"/unassignContestToStudents/:contestId", element:<AssignedContest />},
      { path:"/duplicate", element:<Duplicate />},
      { path:"/contests/:id/dashboard", element:<ContestDashboard />},
      { path:"/session-management", element:<SessionManagement />},
    ],
  },
]);

const Body = () => (
  <RouterProvider router={appRouter} />
);

export default Body;
