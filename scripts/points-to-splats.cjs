// Polycam / LiDAR point cloud PLY (double x,y,z + uchar red,green,blue; z up) -> 3D Gaussian
// splat PLY the tour viewer can show. Each point becomes a small round, nearly opaque splat in
// its colour. Used for the Business Room (apps/web/tours/business-room.json).
//
//   node scripts/points-to-splats.cjs <scan.ply> <out.splats.ply> <floorZ> <sigma>
//     floorZ  the floor's z in the scan (from a height histogram), so the floor lands on y = 0
//     sigma   splat size in metres, about the point spacing (0.012 for a ~1 cm Polycam scan)
//
// Then compress and build walk collision with PlayCanvas splat-transform (needs a GPU):
//   npx @playcanvas/splat-transform out.splats.ply room.sog
//   npx @playcanvas/splat-transform out.splats.ply --voxel-external-fill room.voxel.json
//
const fs = require("fs");
const [, , input, output, floorArg, sigmaArg] = process.argv;
const FLOOR = Number(floorArg);        // z of the floor in the scan
const SIGMA = Number(sigmaArg);        // splat size (std dev, m), about 0.6x the point spacing
const buf = fs.readFileSync(input);
const hEnd = buf.indexOf("end_header\n") + 11;
const header = buf.slice(0, hEnd).toString();
const n = +header.match(/element vertex (\d+)/)[1];
if (!/property double x[\s\S]*property uchar blue/.test(header)) throw new Error("unexpected PLY layout");
const props = ["x", "y", "z", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"];
const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${n}\n${props.map((p) => `property float ${p}`).join("\n")}\nend_header\n`;
const out = Buffer.alloc(head.length + n * props.length * 4);
out.write(head, 0, "ascii");
const SH0 = 0.28209479177387814;
const logS = Math.log(SIGMA), opacity = Math.log(0.97 / 0.03); // logit(0.97)
let o = head.length;
for (let i = 0; i < n; i++) {
  const p = hEnd + i * 27;
  const x = buf.readDoubleLE(p), y = buf.readDoubleLE(p + 8), z = buf.readDoubleLE(p + 16);
  const vals = [-x, FLOOR - z, -y,
    (buf[p + 24] / 255 - 0.5) / SH0, (buf[p + 25] / 255 - 0.5) / SH0, (buf[p + 26] / 255 - 0.5) / SH0,
    opacity, logS, logS, logS, 1, 0, 0, 0];
  for (const v of vals) { out.writeFloatLE(v, o); o += 4; }
}
fs.writeFileSync(output, out);
console.log(`wrote ${n} splats, ${(out.length / 1e6).toFixed(1)} MB`);
