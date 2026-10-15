import { useState } from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import axiosInstance from "../utils/axiosInstance";
import { errorMessage } from "../utils/errorMessage";
import TemporaryPasswords from "./TemporaryPasswords";

export default function InitialPasswordButton({ userId, namespace }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const issue = async (event) => {
    event.stopPropagation();
    setLoading(true);
    try {
      const response = await axiosInstance.post(`${namespace}/issue-initial-password`, { userId });
      setCredentials(response.data.temporaryPasswords);
    } catch (error) { toast.error(errorMessage(error.response?.data?.message || error.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  return <div onClick={(event) => event.stopPropagation()}>
    <button className="ui-gradient rounded px-3 py-2 mb-2" disabled={loading} onClick={issue}>{loading ? "Issuing…" : "Issue temporary password"}</button>
    <TemporaryPasswords credentials={credentials} onDismiss={() => setCredentials([])} />
  </div>;
}
InitialPasswordButton.propTypes = { userId: PropTypes.string.isRequired, namespace: PropTypes.oneOf(["admin", "faculty"]).isRequired };
