import PropTypes from "prop-types";

export default function TemporaryPasswords({ credentials, onDismiss }) {
  if (!credentials.length) return null;
  return <section className="ui-surface p-4 my-4 rounded-lg border border-slate-200" aria-label="Temporary passwords">
    <h2 className="font-semibold">Temporary passwords</h2>
    <p className="my-2 text-sm">Give each password to the matching account holder privately. They must change it at first login. Passwords are shown here only for this operation.</p>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Account</th><th className="p-2">Temporary password</th></tr></thead><tbody>{credentials.map((row) => <tr key={row.id}><td className="p-2">{row.id}</td><td className="p-2 font-mono select-all">{row.temporaryPassword}</td></tr>)}</tbody></table></div>
    <button className="ui-gradient rounded px-4 py-2 mt-3" onClick={onDismiss}>Dismiss passwords</button>
  </section>;
}
TemporaryPasswords.propTypes = { credentials: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, temporaryPassword: PropTypes.string.isRequired })).isRequired, onDismiss: PropTypes.func.isRequired };
