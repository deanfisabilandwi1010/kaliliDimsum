// Serah-terima dari adegan siomay 3D ke panggung menu.
// Kedua section saling menumpuk selama HANDOFF × tinggi layar: adegan 3D tetap
// menempel dan meredup, sementara panggung menu (yang sudah menempel di
// atasnya) muncul di tempat. Nilai ini harus sama dengan CSS:
// .anatomy { height: 460svh + 120svh } dan .menu { margin-top: -(100svh + 120svh) }.
export const HANDOFF = 1.2;
