export type AppRole = 'admin' | 'manager' | 'staff' | 'viewer';

export interface Permission {
  id: string;
  label: string;
  description?: string;
}

export interface PagePermissions {
  id: string;
  label: string;
  category: string;
  permissions: Permission[];
}

export const DETAILED_PERMISSIONS: PagePermissions[] = [
  {
    id: 'live-products',
    label: 'Live Sản phẩm',
    category: 'Live',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem danh sách sản phẩm live' },
      { id: 'add', label: 'Thêm', description: 'Thêm sản phẩm vào live' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin sản phẩm' },
      { id: 'delete', label: 'Xóa', description: 'Xóa sản phẩm khỏi live' },
      { id: 'pricing', label: 'Giá', description: 'Xem và chỉnh sửa giá' },
      { id: 'order', label: 'Đơn hàng', description: 'Quản lý đơn hàng' },
    ],
  },
  {
    id: 'facebook-comments',
    label: 'Comment hàng lẻ',
    category: 'Live',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem comments Facebook' },
      { id: 'process', label: 'Xử lý', description: 'Xử lý comments thành đơn' },
      { id: 'delete', label: 'Xóa', description: 'Xóa comments' },
    ],
  },
  {
    id: 'livestream-reports',
    label: 'Báo cáo Livestream',
    category: 'Livestream',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem báo cáo livestream' },
      { id: 'create', label: 'Tạo', description: 'Tạo báo cáo mới' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa báo cáo' },
      { id: 'delete', label: 'Xóa', description: 'Xóa báo cáo' },
      { id: 'export', label: 'Xuất', description: 'Xuất báo cáo' },
    ],
  },
  {
    id: 'products',
    label: 'Sản phẩm',
    category: 'Sản phẩm',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem danh sách sản phẩm' },
      { id: 'create', label: 'Tạo', description: 'Tạo sản phẩm mới' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa sản phẩm' },
      { id: 'delete', label: 'Xóa', description: 'Xóa sản phẩm' },
      { id: 'import', label: 'Import', description: 'Import sản phẩm từ file' },
      { id: 'export', label: 'Export', description: 'Export sản phẩm' },
    ],
  },
  {
    id: 'purchase-orders',
    label: 'Đơn đặt hàng',
    category: 'Đơn hàng',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem đơn đặt hàng' },
      { id: 'create', label: 'Tạo', description: 'Tạo đơn mới' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa đơn' },
      { id: 'delete', label: 'Xóa', description: 'Xóa đơn' },
      { id: 'approve', label: 'Duyệt', description: 'Duyệt đơn hàng' },
      { id: 'cancel', label: 'Hủy', description: 'Hủy đơn hàng' },
    ],
  },
  {
    id: 'goods-receiving',
    label: 'Nhận hàng',
    category: 'Nhận hàng',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem phiếu nhận hàng' },
      { id: 'create', label: 'Tạo', description: 'Tạo phiếu nhận hàng' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa phiếu' },
      { id: 'delete', label: 'Xóa', description: 'Xóa phiếu' },
      { id: 'complete', label: 'Hoàn thành', description: 'Hoàn thành nhận hàng' },
    ],
  },
  {
    id: 'customers',
    label: 'Khách hàng',
    category: 'Khách hàng',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem thông tin khách hàng' },
      { id: 'create', label: 'Tạo', description: 'Tạo khách hàng mới' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin' },
      { id: 'delete', label: 'Xóa', description: 'Xóa khách hàng' },
      { id: 'import', label: 'Import', description: 'Import khách hàng' },
    ],
  },
  {
    id: 'activity-log',
    label: 'Nhật ký hoạt động',
    category: 'Quản trị',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem nhật ký hoạt động' },
    ],
  },
  {
    id: 'settings',
    label: 'Cài đặt',
    category: 'Quản trị',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem cài đặt' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa cài đặt hệ thống' },
    ],
  },
  {
    id: 'user-management',
    label: 'Quản lý thành viên',
    category: 'Quản trị',
    permissions: [
      { id: 'view', label: 'Xem', description: 'Xem danh sách thành viên' },
      { id: 'create', label: 'Tạo', description: 'Tạo thành viên mới' },
      { id: 'edit', label: 'Sửa', description: 'Chỉnh sửa thông tin' },
      { id: 'delete', label: 'Xóa', description: 'Xóa thành viên' },
      { id: 'permissions', label: 'Phân quyền', description: 'Quản lý quyền hạn' },
    ],
  },
];

export type PermissionTemplate = {
  [key in AppRole]: {
    label: string;
    description: string;
    permissions: Record<string, Record<string, boolean>>;
  };
};

export const PERMISSION_TEMPLATES: PermissionTemplate = {
  admin: {
    label: 'Quản trị viên',
    description: 'Toàn quyền trên tất cả chức năng',
    permissions: Object.fromEntries(
      DETAILED_PERMISSIONS.map((page) => [
        page.id,
        Object.fromEntries(page.permissions.map((p) => [p.id, true])),
      ])
    ),
  },
  manager: {
    label: 'Quản lý',
    description: 'Quyền quản lý trừ quản lý thành viên',
    permissions: Object.fromEntries(
      DETAILED_PERMISSIONS.map((page) => [
        page.id,
        Object.fromEntries(
          page.permissions.map((p) => [
            p.id,
            page.id !== 'user-management', // All except user management
          ])
        ),
      ])
    ),
  },
  staff: {
    label: 'Nhân viên',
    description: 'Quyền xem, thêm và sửa',
    permissions: Object.fromEntries(
      DETAILED_PERMISSIONS.map((page) => [
        page.id,
        Object.fromEntries(
          page.permissions.map((p) => [
            p.id,
            ['view', 'add', 'create', 'edit', 'process'].includes(p.id),
          ])
        ),
      ])
    ),
  },
  viewer: {
    label: 'Người xem',
    description: 'Chỉ có quyền xem',
    permissions: Object.fromEntries(
      DETAILED_PERMISSIONS.map((page) => [
        page.id,
        Object.fromEntries(page.permissions.map((p) => [p.id, p.id === 'view'])),
      ])
    ),
  },
};

export const AVAILABLE_PAGES = DETAILED_PERMISSIONS.map((p) => p.id);
