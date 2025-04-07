import { MousePointerClick } from "lucide-react";
import { Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <>
      <div className="flex">
        <div className="min-h-screen w-1/2 flex items-center justify-center bg-gradient-to-br from-purple-100 via-blue-200 to-blue-300">
          <div className="bg-white/10 backdrop-blur-lg p-10 rounded-2xl max-w-md w-full shadow-2xl text-white">
            <div className="text-left space-y-6">
              <MousePointerClick size={90} />
              <div className="flex items-center space-x-2">
                <h1 className="text-3xl font-semibold leading-tight">
                  Collaborate in real-time
                  <br />
                  on a shared{" "}
                  <span className="text-white font-extrabold">whiteboard.</span>
                </h1>
              </div>
              <p className="text-sm text-white/80">
                You will never know everything.
                <br />
                But you will know more.
              </p>
            </div>
          </div>
        </div>
        <div className="flex justify-center items-center w-1/2 ">
          <Outlet />
        </div>
      </div>
    </>
  );
}

export default AuthLayout;
