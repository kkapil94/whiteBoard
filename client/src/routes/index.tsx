import React, { lazy, Suspense, useState } from "react";
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
import Whiteboard from "@/pages/Whiteboard";
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
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);
  const [canvasHeight, setCanvasHeight] = useState(window.innerHeight - 60); // Account for header

  // Update canvas size on window resize
  React.useEffect(() => {
    const handleResize = () => {
      setCanvasWidth(window.innerWidth);
      setCanvasHeight(window.innerHeight - 60);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return (
    <>
      <Router>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Signup />} />
          </Route>
          <Route
            path="/"
            element={<Whiteboard width={canvasWidth} height={canvasHeight} />}
          />
        </Routes>
      </Router>
      <Toaster />
    </>
  );
};

export default AppRoutes;
