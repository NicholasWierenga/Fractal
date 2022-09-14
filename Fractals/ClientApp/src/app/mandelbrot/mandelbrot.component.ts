import { Component, OnInit } from '@angular/core';
import { Point } from '../point';
import * as PlotlyJS from 'plotly.js-dist-min';
import { create, all, MathJsStatic, Complex, BigNumber } from 'mathjs';

@Component({
  selector: 'app-mandelbrot',
  templateUrl: './mandelbrot.component.html',
  styleUrls: ['./mandelbrot.component.css']
})

export class MandelbrotComponent implements OnInit {
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
  xWindowLower: string = "-2";
  xWindowUpper: string = "2";
  yWindowLower: string = "-2";
  yWindowUpper: string = "2";

  constructor() { } 
  
  findTrace(): void {
    console.log("in findtrace");
    let points: Point[] = this.getNewPoints();

    this.getGraph(points);
  }

  getNewPoints(): Point[] {
    let points: Point[] = [];
    let pointVal: Complex;
    let previousVals: Complex[] = [];
    let startingVal: Complex;
    let xStepDistance = this.math.bignumber(this.xWindowUpper).minus(this.math.bignumber(this.xWindowLower)).div(this.xSteps);
    let yStepDistance = this.math.bignumber(this.yWindowUpper).minus(this.math.bignumber(this.yWindowLower)).div(this.ySteps);
    console.log("in get new points");

    for (let xVal: BigNumber = this.math.bignumber(this.xWindowLower); xVal.lessThanOrEqualTo(this.xWindowUpper); xVal = xVal.plus(xStepDistance)) {
      for (let yVal: BigNumber = this.math.bignumber(this.yWindowLower); yVal.lessThanOrEqualTo(this.yWindowUpper); yVal = yVal.plus(yStepDistance)) {
        startingVal = this.math.complex(`${xVal.toString()} + ${yVal.toString()}i`);
        console.log("startingVal: " + startingVal.toString())
        pointVal = startingVal;

        for (let count: number = 1; count < 5; count++) {
          pointVal = this.math.complex(this.math.add(this.math.pow(pointVal, 2), startingVal).toString());

          if (previousVals.findIndex(val => val.re == pointVal.re && val.im == pointVal.im) !== -1) {
            points.push({xcoord: xVal.toString(), ycoord: `${yVal}`, zcoord: null});

            console.log("found a good point, which is: " + pointVal.toString());

            break;
          }

          previousVals.push(pointVal);
        }

      }
    }

    console.log("Printing out good values below: ");
    points.forEach(point => {
      console.log(point.xcoord + " + " + point.ycoord);
    });

    return points;
  }

  getGraph(points: Point[]): void {
    let layout: Partial<PlotlyJS.Layout> = {
      xaxis: {range: [this.xWindowLower, this.xWindowUpper]},
      //yaxis: {range: [this.yWindowLower, this.yWindowUpper]}
    };

    var trace: Partial<PlotlyJS.PlotData> = this.getTrace(points);
    
    PlotlyJS.newPlot("plotlyChart", [trace], layout);
  }

  getTrace(points: Point[]): Partial<PlotlyJS.PlotData> {
    var trace: Partial<PlotlyJS.PlotData> = {
      x: points.map(point => point.xcoord),
      y: points.map(point => point.ycoord),
      //autobinx: false,
      //xbins: {
      //  start: -3,
      //  end: 3,
      //  size: 0.01
      //},
      //type: 'histogram2d',
      mode: 'markers',
      type: "scatter",
    };

    return trace;
  }

  ngOnInit(): void {
    
  }
}
