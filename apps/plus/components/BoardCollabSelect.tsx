export default function BoardCollabSelect({ value = 0 }: { value?: 0 | 1 }) {
    return <label className="block text-sm font-semibold">
        Collaboration
        <select name="collabFlg" defaultValue={value}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500">
            <option value={0}>Standard board</option>
            <option value={1}>Live collaboration board</option>
        </select>
        <span className="mt-1 block text-xs font-normal text-neutral-600">
            Live boards show who is online and lock cards while someone edits them.
        </span>
    </label>;
}
