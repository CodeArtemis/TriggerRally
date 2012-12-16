{

"metadata" :
{
    "formatVersion" : 3,
    "sourceFile"    : "grass-triangle.blend",
    "generatedBy"   : "Blender 2.63 Exporter",
    "objects"       : 1,
    "geometries"    : 1,
    "materials"     : 1,
    "textures"      : 1
},

"type" : "scene",
"urlBaseType" : "relativeToScene",


"objects" :
{
    "Plane" : {
        "geometry"  : "geo_Plane",
        "groups"    : [  ],
        "materials" : [ "Material" ],
        "position"  : [ 0.000000, 0.000000, 0.000000 ],
        "rotation"  : [ 0, -0.000000, 0.000000 ],
        "quaternion": [ 1, 0, 0.000000, 0.000000 ],
        "scale"     : [ 3, 1.7, 1.5 ],
        "visible"       : true,
        "castShadow"    : false,
        "receiveShadow" : true,
        "doubleSided"   : true
    }
},


"geometries" :
{
    "geo_Plane" : {
        "type" : "embedded_mesh",
        "id"  : "emb_Plane"
    }
},


"textures" :
{
    "grass-sprite.png" : {
        "url": "../../textures/grass-sprite.png",
        "wrap": ["repeat", "repeat"]
    }
},


"materials" :
{
    "Material" : {
        "type": "MeshLambertMaterial",
        "parameters": { "color": 10724259, "opacity": 1, "map": "grass-sprite.png", "transparent": true, "blending": "NormalBlending", "depthWrite": false, "alphaTest": 0 }
    }
},


"embeds" :
{
"emb_Plane": {    "scale" : 1.000000,

    "materials": [	{
	"DbgColor" : 15658734,
	"DbgIndex" : 0,
	"DbgName" : "Material",
	"blending" : "NormalBlending",
	"colorAmbient" : [0.0, 0.0, 0.0],
	"colorDiffuse" : [0.6400000190734865, 0.6400000190734865, 0.6400000190734865],
	"colorSpecular" : [0.5, 0.5, 0.5],
	"depthTest" : true,
	"depthWrite" : false,
	"mapDiffuse" : "grass-sprite.png",
	"mapDiffuseWrap" : ["repeat", "repeat"],
	"shading" : "Lambert",
	"specularCoef" : 50,
	"transparency" : 1.0,
	"transparent" : true,
	"vertexColors" : false
	}],

    "vertices": [1.000000,0.000000,0.000000,-1.000000,0.000000,0.000000,0.000000,0.000000,2.000000],

    "morphTargets": [],

    "normals": [0.000000,0.000000,1.000000],

    "colors": [],

    "uvs": [[-0.225462,1.003063,1.221866,1.003619,0.499814,0.004016]],

    "faces": [42,1,0,2,0,0,1,2,0,0,0]

}
},


"transform" :
{
    "position"  : [ 0.000000, 0.000000, 0.000000 ],
    "rotation"  : [ 0, 0.000000, 0.000000 ],
    "scale"     : [ 1.000000, 1.000000, 1.000000 ]
},

"defaults" :
{
    "bgcolor" : [ 0.000000, 0.000000, 0.000000 ],
    "bgalpha" : 1.000000,
    "camera"  : ""
}

}
