import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";

const Layout = () => {
  const location = useLocation();

  // Specify the routes where the Header should not appear
  const noHeaderRoutes = ["/problems/:id"];

  // Check if the current route matches any of the noHeaderRoutes
  const isNoHeaderRoute = noHeaderRoutes.some((route) => {
    const routePattern = new RegExp(`^${route.replace(":id", "[^/]+")}$`);
    return routePattern.test(location.pathname);
  });

  return (
    <div>
      {!isNoHeaderRoute && <Header />}
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
