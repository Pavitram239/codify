import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";
import { can } from "../../utils/permissions";

export const ApprovalCountsContext = createContext(null);
export const useApprovalCounts = () => useContext(ApprovalCountsContext);

export function usePendingApprovals(user, pathname) {
  const userId = user?._id;
  const facultyAllowed = can(user, "users.approve_all");
  const studentsAllowed = can(user, "users.approve_assigned", "users.approve_all");
  const owner = `${userId}:${facultyAllowed}:${studentsAllowed}`;
  const [state, setState] = useState({ owner: "", faculty: null, students: null });
  useEffect(() => {
    let active = true;
    const load = async () => {
      const requests = [
        ["faculty", facultyAllowed, "/admin/get-pending-users", { page: 1 }],
        ["students", studentsAllowed, "/faculty/get-pending-users", { page: 1, facultyId: userId }],
      ];
      await Promise.allSettled(requests.filter(([, allowed]) => allowed && userId).map(async ([kind, , url, params]) => {
        try {
          const { data } = await axios.get(url, { params });
          const count = data.total ?? data.totalUsers;
          if (active) setState((previous) => ({ ...(previous.owner === owner ? previous : { faculty: null, students: null }), owner, [kind]: Number.isFinite(count) ? count : null }));
        } catch {
          if (active) setState((previous) => ({ ...(previous.owner === owner ? previous : { faculty: null, students: null }), owner, [kind]: null }));
        }
      }));
    };
    load();
    window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [userId, facultyAllowed, studentsAllowed, owner, pathname]);
  const setCount = useCallback((kind, count) => {
    setState((previous) => ({ ...(previous.owner === owner ? previous : { faculty: null, students: null }), owner, [kind]: Math.max(0, count) }));
  }, [owner]);
  const adjustCount = useCallback((kind, difference) => {
    setState((previous) => previous.owner === owner && previous[kind] !== null ? { ...previous, [kind]: Math.max(0, previous[kind] + difference) } : previous);
  }, [owner]);
  const counts = state.owner === owner ? state : { faculty: null, students: null };
  const known = (!facultyAllowed || counts.faculty !== null) && (!studentsAllowed || counts.students !== null);
  return { counts, setCount, adjustCount, total: known ? (facultyAllowed ? counts.faculty : 0) + (studentsAllowed ? counts.students : 0) : null };
}
