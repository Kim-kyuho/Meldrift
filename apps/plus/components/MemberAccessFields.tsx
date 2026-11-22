export const memberFieldClass = "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2";

type Props = {
    isApproved?: boolean;
    role?: string;
    readOnly?: boolean;
    lockAdminRole?: boolean;
};

export default function MemberAccessFields({
    isApproved = false, role = "user", readOnly = false, lockAdminRole = false,
}: Props) {
    return <>
        <label className="flex items-center gap-2">
            <input type="checkbox" name="isApproved" defaultChecked={isApproved} disabled={readOnly} />
            Board authoring
        </label>
        <label className="block">Role
            <select name="role" className={memberFieldClass} defaultValue={role} disabled={readOnly}>
                <option value="user" disabled={lockAdminRole}>User</option>
                <option value="admin">Administrator</option>
            </select>
        </label>
    </>;
}
