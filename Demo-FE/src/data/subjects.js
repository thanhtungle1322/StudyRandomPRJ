export const SUBJECTS = [
  { id: 'math', name: 'Toán học' },
  { id: 'physics', name: 'Vật lý' },
  { id: 'hoa', name: 'Hóa học' },
  { id: 'sinh', name: 'Sinh học' },
  { id: 'tinhoc', name: 'Tin học' },
  { id: 'english', name: 'Tiếng Anh' },
  { id: 'van', name: 'Ngữ văn' },
  { id: 'lichsu', name: 'Lịch sử' },
  { id: 'diali', name: 'Địa lí' },
  { id: 'gdcd', name: 'GDCD' },
  { id: 'python', name: 'Python' },
  { id: 'nodejs', name: 'NodeJS' },
  { id: 'react', name: 'React' },
  { id: 'database', name: 'Cơ sở dữ liệu' },
  { id: 'algorithm', name: 'Thuật toán' },
  { id: 'java', name: 'Java' },
  { id: 'csharp', name: 'C#' },
  { id: 'cpp', name: 'C/C++' },
  { id: 'flutter', name: 'Flutter' },
  { id: 'ai', name: 'AI / ML' },
  { id: 'mang_may_tinh', name: 'Mạng máy tính' },
  { id: 'an_toan_thong_tin', name: 'An toàn thông tin' },
  { id: 'triet', name: 'Triết học' },
  { id: 'kinh_te', name: 'Kinh tế' },
  { id: 'tam_ly', name: 'Tâm lý học' },
  { id: 'ke_toan', name: 'Kế toán' },
  { id: 'phap_luat', name: 'Pháp luật' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'quan_tri', name: 'Quản trị kinh doanh' },
  { id: 'xa_hoi_hoc', name: 'Xã hội học' },
  { id: 'luat_dai_cuong', name: 'Luật đại cương' },
  { id: 'tieng_anh_gt', name: 'Tiếng Anh giao tiếp' },
  { id: 'tieng_trung', name: 'Tiếng Trung' },
  { id: 'tieng_nhat', name: 'Tiếng Nhật' },
  { id: 'tieng_han', name: 'Tiếng Hàn' },
  { id: 'giai_phau', name: 'Giải phẫu học' },
  { id: 'duoc_ly', name: 'Dược lý học' },
  { id: 'dinh_duong', name: 'Dinh dưỡng học' },
  { id: 'graphic_design', name: 'Thiết kế đồ họa' },
  { id: 'ux_ui', name: 'Thiết kế UX/UI' },
  { id: 'nhiep_anh', name: 'Nhiếp ảnh cơ bản' },
];

export const SUBJECT_NAME_BY_ID = Object.fromEntries(
  SUBJECTS.map((subject) => [subject.id, subject.name])
);

export function getSubjectName(subjectId) {
  if (subjectId === '__quick__') return 'Học Tự Do';
  return SUBJECT_NAME_BY_ID[subjectId] || subjectId || 'Môn học';
}