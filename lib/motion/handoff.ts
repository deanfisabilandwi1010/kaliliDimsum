// Serah-terima dari ritual kukusan ke panggung menu.
// Kedua section saling menumpuk selama HANDOFF × tinggi layar: ritual tetap
// menempel sementara lampunya padam (iris menutup ke kukusan), dan panggung
// menu (yang sudah menempel di atasnya) muncul di tempat. Nilai ini harus sama
// dengan CSS: .story { height: 400svh + 120svh } dan .menu { margin-top: -(100svh + 120svh) }.
export const HANDOFF = 1.2;

// Tirai: ritual naik menutupi adegan siomay 3D yang masih menempel selama
// CURTAIN × tinggi layar. Harus sama dengan CSS: .anatomy { height: 460svh + 100svh }
// dan .story { margin-top: -100svh }.
export const CURTAIN = 1;
