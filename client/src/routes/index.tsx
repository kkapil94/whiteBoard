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
import BoardLayout from "@/layouts/BoardLayout";
import Dashboard from "@/pages/Dashboard";
import Whiteboard from "@/pages/Whiteboard";

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    // If not authenticated, redirect to login
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

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
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Signup />} />
          </Route>

          {/* Dashboard and board management */}
          <Route
            element={
              <ProtectedRoute>
                <BoardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Individual whiteboard route */}
          <Route
            path="/board/:boardId"
            element={
              <ProtectedRoute>
                <Whiteboard width={canvasWidth} height={canvasHeight} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
      <Toaster />
    </>
  );
};

export default AppRoutes;
