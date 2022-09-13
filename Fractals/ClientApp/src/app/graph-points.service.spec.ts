import { TestBed } from '@angular/core/testing';

import { GraphPointsService } from './graph-points.service';

describe('GraphPointsService', () => {
  let service: GraphPointsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GraphPointsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
