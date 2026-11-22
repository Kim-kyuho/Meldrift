export default function BoardVisibilitySelect({ value = 1 }: { value?: 0 | 1 }) {
    return <label className="block text-sm font-semibold">
        Visibility
        <select name="privateFlg" defaultValue={value}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500">
            <option value={1}>Private</option>
            <option value={0}>Public</option>
        </select>
    </label>;
}
