export const sampleMCVRATree = {
  "id": "root_risk",
  "name": "Root Risk",
  "formula": "(Hazard+Exposure+Vulnerability-Lack coping Capacity))/100",
  "type": "criteria",
  "children": [
    {
      "id": "hazard",
      "name": "Hazard",
      "formula": null,
      "type": "criteria",
      "children": [
        {
          "id": "flood_raster_calc",
          "name": "Raster_Calculation",
          "type": "raster_calculation",
          "children": [
            {
              "id": "glofas_flood_depth",
              "name": "GLOFAS_Flood_Depth",
              "type": "raster",
              "choices": [
                { "name": "0 - 0.5 m", "score": 0.2 },
                { "name": "0.5 - 1.5 m", "score": 0.6 },
                { "name": "> 1.5 m", "score": 1.0 }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "exposure",
      "name": "Exposure",
      "type": "criteria",
      "children": [
        {
          "id": "topographical",
          "name": "Topographical",
          "type": "criteria",
          "children": [
            {
              "id": "dist_water",
              "name": "distToWatersource",
              "type": "question",
              "choices": [
                { "name": "0 - 200 m", "score": 1.0 },
                { "name": "200 - 500 m", "score": 0.8 },
                { "name": "500 - 1000 m", "score": 0.5 }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "vulnerability",
      "name": "Vulnerability",
      "type": "criteria",
      "children": [
        {
          "id": "structural",
          "name": "Structural/Infrastructural",
          "type": "criteria",
          "children": [
            {
              "id": "building_typology",
              "name": "buildingTypology",
              "type": "question",
              "choices": [
                { "name": "Mud Brick House", "score": 1.0 },
                { "name": "Reinforced Concrete", "score": 0.2 }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "coping_capacity",
      "name": "Lack of coping Capacity",
      "type": "criteria",
      "children": [
        {
          "id": "institutional",
          "name": "Institutional Support",
          "type": "criteria",
          "children": [
            {
              "id": "early_warning",
              "name": "earlyWarningAccess",
              "type": "question",
              "choices": [
                { "name": "No Access", "score": 1.0 },
                { "name": "Full Access", "score": 0.1 }
              ]
            }
          ]
        }
      ]
    }
  ]
};
