uniform vec3 diffuse;
uniform float opacity;
varying vec2 vUv;
uniform sampler2D map;

void main() {
  gl_FragColor = vec4( 1, 0, 0, 1 );
  //gl_FragColor = gl_FragColor * texture2D( map, vUv );
}
