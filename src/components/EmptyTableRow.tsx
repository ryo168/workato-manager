// テーブルが空のときに表示する「データないよ」行

import { TD } from "../lib/tw";

interface Props {
  colSpan: number;
  message: string;
}

export default function EmptyTableRow({ colSpan, message }: Props) {
  return (
    <tr>
      <td colSpan={colSpan} className={`${TD} py-10 text-center text-gray-400`}>
        {message}
      </td>
    </tr>
  );
}
