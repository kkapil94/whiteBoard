import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "../pages/Login";
import { Toaster } from "sonner";
import { Signup } from "@/pages/SignUp";
import AuthLayout from "@/layouts/AuthLayout";
// import MainLayout from "../layouts/MainLayout";
// import DashboardLayout from "../layouts/DashboardLayout";
// import ProtectedRoute from "./ProtectedRoute"; // Auth-based route protection
// import Loader from "../components/Loader"; // Fallback loader

// Lazy-loaded pages for better performance
// const Home = lazy(() => import("../pages/Home"));
// const About = lazy(() => import("../pages/About"));
// const Dashboard = lazy(() => import("../pages/Dashboard"));
// const Login = lazy(() => import("../pages/Login"));
// const NotFound = lazy(() => import("../pages/NotFound"));

const AppRoutes = () => {
  return (
    <>
      <Router>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Signup />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </>
  );
};

export default AppRoutes;
