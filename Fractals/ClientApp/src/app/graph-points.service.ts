import { Injectable } from '@angular/core';
import { create, all, MathJsStatic } from 'mathjs';
import { Point } from './point';
import * as PlotlyJS from 'plotly.js-dist-min';

@Injectable({
  providedIn: 'root'
})
export class GraphPointsService {
  config: math.ConfigOptions = {
    epsilon: 1e-32,
    matrix: 'Matrix',
    number: 'BigNumber',
    precision: 64,
    predictable: false,
    randomSeed: null
  };
  math: MathJsStatic = create(all, this.config);

  xSteps: number = 100;
  ySteps: number = 100;

  constructor() { }
  
  findTrace(equation: string, xWindowLower: string, xWindowUpper: string, yWindowLower: string, yWindowUpper: string): void {
    let points: Point[] = this.getNewPoints(equation);

    this.getGraph(equation, points, xWindowLower, xWindowUpper, yWindowLower, yWindowUpper);
  }

  // This takes and has sorted the points passed to it then calculates unknown points. Calculated points are then saved in the DB.
  getNewPoints(equation: string): Point[] {
    let points: Point[] = [];

    // We iterate through an array, filling in undefined elements with points according to index.
    for (let xVal: number = 0; xVal < this.xSteps; xVal++) {
      for (let yVal: number = 0; yVal < this.ySteps; yVal++) {
        points.push({xcoord: xVal.toString(), ycoord: yVal.toString()
        , zcoord: this.math.evaluate(equation, {x: xVal, y: yVal}).toString()});
      }
    }

    return points;
  }

  getGraph(equation: string, points: Point[], xWindowLower: string, xWindowUpper: string, yWindowLower: string, yWindowUpper: string): void {
    let layout: Partial<PlotlyJS.Layout> = {
      xaxis: {range: [xWindowLower, xWindowUpper]}
    };
    
    if (yWindowLower !== "" && yWindowUpper !== "") {
      layout.yaxis = {range: [yWindowLower, yWindowUpper]};
    }

    var trace: Partial<PlotlyJS.PlotData> = this.getTrace(equation, points);
    
    PlotlyJS.newPlot("plotlyChart", [trace], layout);
  }

  // Takes in an array of points and splits it up into PlotlyJS data.
  getTrace(equation: string, points: Point[]): Partial<PlotlyJS.PlotData> {
    let splitPoints: Point[][] = [];
    let startAtIndex: number = 0;
    let endAtIndex: number = this.xSteps + 1;

    // Because we sorted pointsToGraph by xcoord, we can split it apart into a number of arrays, each with the same xcoord
    while (startAtIndex < points.length) {
      splitPoints.push(points.slice(startAtIndex, endAtIndex));

      startAtIndex = endAtIndex;
      endAtIndex += this.xSteps + 1;
    }

    // PlotlyJS likes to have 3d graph data that is split up into a number of arrays, each one signifying a line.
    // For here, since we sorted by xcoord above, splitPoints[0] would correspond to the line of points along y-axis.
    // Without splitting the array, PlotlyJS assumes everything is contained on one great big line and starts 
    // connecting points and forming surfaces together, often causing false surfaces in the output.
    var trace: Partial<PlotlyJS.PlotData> = {
      x: splitPoints.map(pointArray => pointArray.map(point => point.xcoord)),
      y: splitPoints.map(pointArray => pointArray.map(point => point.ycoord)),
      z: splitPoints.map(pointArray => pointArray.map(point => point.zcoord)),
      name: equation,
      type: "surface",
      hovertemplate: `(%{x},%{y},%{z})` // %{x} is what tells PlotlyJS to display the xcoord for what point the cursor is on.
    };

    return trace;
  }
}