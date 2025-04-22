import React from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { FaChalkboard, FaUserCircle, FaSignOutAlt } from "react-icons/fa";
import { toast } from "sonner";

const BoardLayout: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b p-4 shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FaChalkboard className="text-blue-500 text-xl" />
            <h1
              className="text-xl font-bold cursor-pointer text-blue-500"
              onClick={() => navigate("/dashboard")}
            >
              Whiteboard App
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FaUserCircle className="text-gray-600" />
              <span className="font-medium">
                {user.name || user.username || "User"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors"
              title="Logout"
            >
              <FaSignOutAlt />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-gray-50">
        <Outlet />
      </main>

      <footer className="bg-white border-t p-4">
        <div className="container mx-auto text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Whiteboard App - All Rights Reserved
        </div>
      </footer>
    </div>
  );
};

export default BoardLayout;
