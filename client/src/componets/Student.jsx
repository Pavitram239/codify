import { can } from "../utils/permissions";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
export default function Student() {
  const user = useSelector((state) => state.app.user);
  const destination =
    can(user, "users.view_all")
      ? "/studentinformation"
      : can(user, "users.view_assigned")
        ? `/students/${user._id}`
        : "/browse";
  return <Navigate to={destination} replace />;
}
