/***********************************
 *  Global settings (edit as needed)
 *
 * You may adjust the Landsat (L) and Sentinel-2 (S) cloud thresholds 
 * based on data quality in your study area. These thresholds are applied 
 * to scenes intersecting the polygon of interest, but they may not fully 
 * reflect conditions outside that polygon.
 *
 * The upper bound on HPI (e.g., 1.5 or 2.0) acts as a complementary 
 * quality control step. While cloud thresholds filter out poor-quality 
 * images, residual atmospheric effects or sensor artifacts can still 
 * produce abnormally high HPI values. The upper bound helps cap these 
 * unrealistic values, ensuring that subsequent harvest detection focuses 
 * on physically meaningful signals.
 *
 * The Harmonized Landsat–Sentinel (HLS) dataset is now available in 
 * Google Earth Engine (GEE). Using HLS can provide a more consistent 
 * set of observations across sensors. You can switch to HLS if higher 
 * consistency is required.
 ***********************************/

var yearStart          = 2024;                  // Year to process
var earliest_date      = yearStart + '-08-01';
var latest_date        = yearStart + '-12-31';
var LcloudThreshold    = 75;                   // Landsat CLOUD_COVER %
var ScloudThreshold    = 75;                   // Sentinel2 CLOUD_COVER %
var ndsi_threshold     = -0.3;                  // For masking
var upper_bound_HPI    = 1.5;   // Upper limit for HPI values (use 1.5 for stricter filtering, 2.0 for more lenient)
var threshold_HPI_valid = 0.8;                  // Min HPI in window
var scale_factor       = 13;                    // Map zoom scale
var HPI_threshold      = 0.60;                  // Fixed NHPI threshold
var point              = ee.Geometry.Point([-88.06497453373734, 38.86122325263095]); // Fixed point
var polygon            = point.buffer(2500);    // 5 km buffer
/****************************************************************/

Map.centerObject(point, scale_factor);
var mapTitle = ui.Label({
  value: 'Estimated Harvest Dates for Corn and Soybean (' + yearStart + ')',
  style: {
    position: 'top-center',
    fontWeight: 'bold',
    fontSize: '18px',
    padding: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    border: '1px solid gray'
  }
});
Map.add(mapTitle);
Map.style().set('cursor', 'crosshair');


/********************  INDEX CALCULATORS  ************************/

// Landsat-9: HPI & NDSI
var L9calculateHPI_NDSI = function (image) {
  var scale = 0.0000275;

  // --- HPI ---
  var red = image.select('SR_B4').multiply(scale).add(-0.2)
                 .multiply(0.9690).add(0.0021).rename('red');
  var nir = image.select('SR_B5').multiply(scale).add(-0.2)
                 .multiply(0.9545).add(0.0112).rename('NIR');
  var hpi = nir.add(red).divide(nir.subtract(red).divide(nir))
               .rename('HPI');

  // --- NDSI ---
  var green = image.select('SR_B3').multiply(scale).add(-0.2)
                   .multiply(0.9690).add(0.0021).rename('Green');
  var swir  = image.select('SR_B6').multiply(scale).add(-0.2)
                   .multiply(0.9545).add(0.0112).rename('SWIR');
  var ndsi  = green.subtract(swir).divide(green.add(swir)).rename('NDSI');

  return image.addBands([hpi, ndsi]);
};

// Landsat-8: HPI & NDSI
var L8calculateHPI_NDSI = function (image) {
  var scale = 0.0000275;

  var red = image.select('SR_B4').multiply(scale).add(-0.2).rename('red');
  var nir = image.select('SR_B5').multiply(scale).add(-0.2).rename('NIR');
  var hpi = nir.add(red).divide(nir.subtract(red).divide(nir)).rename('HPI');

  var green = image.select('SR_B3').multiply(scale).add(-0.2).rename('Green');
  var swir  = image.select('SR_B6').multiply(scale).add(-0.2).rename('SWIR');
  var ndsi  = green.subtract(swir).divide(green.add(swir)).rename('NDSI');

  return image.addBands([hpi, ndsi]);
};

// Landsat-7: HPI & NDSI
var L7calculateHPI_NDSI = function (image) {
  var scale = 0.0000275;

  var red = image.select('SR_B3').multiply(scale).add(-0.2)
                 .multiply(0.9047).add(0.0061).rename('red');
  var nir = image.select('SR_B4').multiply(scale).add(-0.2)
                 .multiply(0.8462).add(0.0412).rename('NIR');
  var hpi = nir.add(red).divide(nir.subtract(red).divide(nir)).rename('HPI');

  var green = image.select('SR_B2').multiply(scale).add(-0.2)
                   .multiply(0.9047).add(0.0061).rename('Green');
  var swir  = image.select('SR_B5').multiply(scale).add(-0.2)
                   .multiply(0.8462).add(0.0412).rename('SWIR');
  var ndsi  = green.subtract(swir).divide(green.add(swir)).rename('NDSI');

  return image.addBands([hpi, ndsi]);
};

// Sentinel-2: HPI & NDSI
var S2calculateHPI_NDSI = function (image) {
  var scale = 0.0001;

  var red = image.select('B4').multiply(scale).multiply(0.9533)
                 .add(0.0041).rename('red');
  var nir = image.select('B8A').multiply(scale).multiply(0.9644)
                 .add(0.0077).rename('NIR');
  var hpi = nir.add(red).divide(nir.subtract(red).divide(nir)).rename('HPI');

  var green = image.select('B3').multiply(scale).multiply(0.9533)
                   .add(0.0041).rename('Green');
  var swir  = image.select('B11').multiply(scale).multiply(0.9644)
                   .add(0.0077).rename('SWIR');
  var ndsi  = green.subtract(swir).divide(green.add(swir)).rename('NDSI');

  return image.addBands([hpi, ndsi]);
};

/********************  NDVI CALCULATORS  ************************/

var L9calculateNDVI = function (image) {
  var s = 0.0000275;
  var red = image.select('SR_B4').multiply(s).add(-0.2)
                 .multiply(0.9690).add(0.0021);
  var nir = image.select('SR_B5').multiply(s).add(-0.2)
                 .multiply(0.9545).add(0.0112);
  return image.addBands(nir.subtract(red).divide(nir.add(red)).rename('NDVI'));
};

var L8calculateNDVI = function (image) {
  var s = 0.0000275;
  var red = image.select('SR_B4').multiply(s).add(-0.2);
  var nir = image.select('SR_B5').multiply(s).add(-0.2);
  return image.addBands(nir.subtract(red).divide(nir.add(red)).rename('NDVI'));
};

var L7calculateNDVI = function (image) {
  var s = 0.0000275;
  var red = image.select('SR_B3').multiply(s).add(-0.2)
                 .multiply(0.9047).add(0.0061);
  var nir = image.select('SR_B4').multiply(s).add(-0.2)
                 .multiply(0.8462).add(0.0412);
  return image.addBands(nir.subtract(red).divide(nir.add(red)).rename('NDVI'));
};

var S2calculateNDVI = function (image) {       // Sentinel-2
  var red = image.select('B4').multiply(0.0001).multiply(0.9533).add(0.0041);
  var nir = image.select('B8A').multiply(0.0001).multiply(0.9644).add(0.0077);
  return image.addBands(nir.subtract(red).divide(nir.add(red)).rename('NDVI'));
};

/********************  CLOUD MASKING  ************************/

// Sentinel-2 (QA60 + radiance threshold)
var sentinel2CloudMask = function (image) {
  var qa   = image.select('QA60');
  var cloud   = qa.bitwiseAnd(1 << 10).eq(0);
  var cirrus  = qa.bitwiseAnd(1 << 11).eq(0);
  var blueOK  = image.select('B2').lte(2000);
  return image.updateMask(cloud).updateMask(cirrus).updateMask(blueOK)
              .select('B.*')
              .copyProperties(image, ['system:time_start']);
};

// S2 cloud-probability asset (requires joining with s2cloudless)
var maskClouds = function (image) {
  var prob = ee.Image(image.get('cloudProbability'));
  return image.updateMask(prob.lt(5));
};


// Landsat-8/9 cloud masking function (extended)
var L89cloudMask = function (image) {
  var qa = image.select('QA_PIXEL');
  var aerosolQa = image.select('SR_QA_AEROSOL');
  var cloudDist = image.select('ST_CDIST');

  // QA_PIXEL masks
  var mask = qa.bitwiseAnd(1 << 0).eq(0)   // fill
    .and(qa.bitwiseAnd(1 << 1).eq(0))      // dilated cloud
    .and(qa.bitwiseAnd(1 << 2).eq(0))      // cirrus
    .and(qa.bitwiseAnd(1 << 3).eq(0))      // cloud
    .and(qa.bitwiseAnd(1 << 4).eq(0));     // cloud shadow
    // Optional: Add .and(qa.bitwiseAnd(1 << 5).eq(0)) for snow mask

  // Optional: filter near-cloud pixels
  var maskNearCloud = cloudDist.lt(0.1).not();

  // Combine QA_PIXEL and ST_CDIST masks
  var finalMask = mask.and(maskNearCloud);

  return image.updateMask(finalMask)
              .select('SR_B.*')
              .copyProperties(image, ['system:time_start']);
};


// Landsat-7 ETM+ (QA_PIXEL)
var L7cloudMask = function (image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 1).eq(0)   // dilated cloud
      .and(qa.bitwiseAnd(1 << 3).eq(0))    // cloud
      .and(qa.bitwiseAnd(1 << 4).eq(0));   // shadow
  return image.updateMask(mask)
              .select('SR_B.*')
              .copyProperties(image, ['system:time_start']);
};


/********************  HELPERS ********************************/
function _doyBandName(prefix, image) {
  var doy = image.date()
                 .difference(ee.Date(yearStart + '-01-01'), 'day')
                 .multiply(1e6).toInt().format();
  return ee.String(prefix).cat(doy);
}
var renameBandsByDoyHPI = function (image) {
  return image.select('HPI').rename(_doyBandName('HPI_DOY_', image));
};
var renameBandsByDoyNDVI = function (image) {
  return image.select('NDVI').rename(_doyBandName('NDVI_DOY_', image));
};

/********************  CORE FUNCTION ***************************/
function computeHarvest(ratio, polygon) {
  var l7 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
              .filterBounds(polygon)
              .filterDate(earliest_date, latest_date)
              .filter(ee.Filter.lt('CLOUD_COVER', LcloudThreshold));
  var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
              .filterBounds(polygon)
              .filterDate(earliest_date, latest_date)
              .filter(ee.Filter.lt('CLOUD_COVER', LcloudThreshold));
  var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
              .filterBounds(polygon)
              .filterDate(earliest_date, latest_date)
              .filter(ee.Filter.lt('CLOUD_COVER', LcloudThreshold));

  var jointFilter = ee.Filter.and(
                      ee.Filter.bounds(polygon),
                      ee.Filter.date(earliest_date, latest_date));
  var innerJoinCondition = ee.Filter.equals({
    leftField:  'system:index',
    rightField: 'system:index'
  });
  var saveFirst = ee.Join.saveFirst('cloudProbability');
  var s2sr = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                .filter(jointFilter)
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', ScloudThreshold));
  var s2prob = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
                  .filter(jointFilter);
  var sentinel2 = ee.ImageCollection(saveFirst.apply(s2sr, s2prob, innerJoinCondition))
                     .map(maskClouds);

  var L7_hpi   = l7.map(L7cloudMask).map(L7calculateHPI_NDSI);
  var L7_ndvi  = l7.map(L7cloudMask).map(L7calculateNDVI);
  var L8_hpi   = l8.map(L89cloudMask).map(L8calculateHPI_NDSI);
  var L8_ndvi  = l8.map(L89cloudMask).map(L8calculateNDVI);
  var L9_hpi   = l9.map(L89cloudMask).map(L9calculateHPI_NDSI);
  var L9_ndvi  = l9.map(L89cloudMask).map(L9calculateNDVI);
  var S2_hpi   = sentinel2.map(sentinel2CloudMask).map(S2calculateHPI_NDSI);
  var S2_ndvi  = sentinel2.map(sentinel2CloudMask).map(S2calculateNDVI);

  var combined_hpi  = L7_hpi.merge(L8_hpi).merge(L9_hpi).merge(S2_hpi);
  var combined_ndvi = L7_ndvi.merge(L8_ndvi).merge(L9_ndvi).merge(S2_ndvi);
  return [combined_hpi, combined_ndvi];
}

/********************  REDRAW (MAIN LOGIC) *********************/
var currentMaskedResult;
var joined;   // <-- declare joined globally

function redraw () {
  var out      = computeHarvest(HPI_threshold, polygon);
  var combined_hpi  = out[0];
  var combined_ndvi = out[1];

  // Mask HPI by NDSI
  var masked_hpi = combined_hpi.map(function (img) {
    var mask = img.select('NDSI').lt(ndsi_threshold).lt(upper_bound_HPI);
    return img.updateMask(mask);
  });

  // Rename and collapse to cubes
  var hpi_renamed  = masked_hpi.map(renameBandsByDoyHPI).sort('system:time_start');
  var ndvi_renamed = combined_ndvi.map(renameBandsByDoyNDVI).sort('system:time_start');

  var hpi_cube  = hpi_renamed.toBands().unmask(-2);
  var ndvi_cube = ndvi_renamed.toBands().unmask(-2);

  // Band lists
  var ndviBands = ndvi_cube.bandNames().getInfo();
  var hpiBands  = hpi_cube.bandNames().getInfo();

  /* 1. Find seasonal NDVI peak and window start */
  var VImaxVal = ee.Image(0);
  var VImaxDOY = ee.Image(0);

  ndviBands.forEach(function (bn) {
    var img  = ndvi_cube.select(bn);
    var doy  = parseFloat(bn.split('_').pop()) / 1e6;
    var cond = img.gte(VImaxVal);
    VImaxVal = VImaxVal.where(cond, img);
    VImaxDOY = VImaxDOY.where(cond, ee.Image(doy));
  });

  var VI50      = VImaxVal.add(0.2).divide(2);
  var windowBeg = ee.Image(0);
  var firstHit  = ee.Image(0);

  ndviBands.forEach(function (bn) {
    var img  = ndvi_cube.select(bn);
    var doy  = parseFloat(bn.split('_').pop()) / 1e6;

    var cond = img.lt(VI50)
              .and(ee.Image.constant(doy).gt(VImaxDOY))
              .and(img.gt(-2))
              .and(firstHit.eq(0));

    firstHit  = firstHit.where(cond, 1);
    windowBeg = windowBeg.where(cond, ee.Image.constant(doy - 5));
  });

  /* 2. HPI peak, min, threshold */
  var HPImax    = ee.Image(0);
  var HPImaxDOY = ee.Image(0);

  hpiBands.forEach(function (bn) {
    var img = hpi_cube.select(bn);
    var doy = parseFloat(bn.split('_').pop()) / 1e6;
    var cond = ee.Image(doy).gt(VImaxDOY).and(img.lt(upper_bound_HPI));
    img  = img.updateMask(cond);
    var larger = img.gt(HPImax);
    HPImax     = HPImax.where(larger, img);
    HPImaxDOY  = HPImaxDOY.where(larger, ee.Image(doy));
  });

  var HPImin = ee.Image(2.0);
  hpiBands.forEach(function (bn) {
    var img = hpi_cube.select(bn);
    var doy = parseFloat(bn.split('_').pop()) / 1e6;
    var cond = img.lt(HPImin)
                .and(ee.Image(doy).gt(windowBeg))
                .and(ee.Image(doy).lt(windowBeg.add(60)))
                .and(img.gt(-2));
    HPImin = HPImin.where(cond, img);
  });

  /* 3. Normalize HPI → NHPI cube */
  var nhpi_cube = hpi_cube
                    .updateMask(hpi_cube.lt(upper_bound_HPI))
                    .updateMask(hpi_cube.neq(-2))
                    .subtract(HPImin)
                    .divide(HPImax.subtract(HPImin));
  var nhpiBands  = nhpi_cube.bandNames().getInfo();
  var firstBandName = nhpiBands[0];

  /* 4. Threshold crossing detection */
  var idx      = ee.Image(0).rename('idx');
  var idxPrev  = ee.Image(0).rename('idxPrev');
  var valIdx   = ee.Image(0).rename('valIdx');
  var valPrev  = ee.Image(0).rename('valPrev');
  var maskImg  = ee.Image(0).rename('mask');
  firstHit     = ee.Image(0).rename('mask');

  var thresh = ee.Image(ee.Number(HPI_threshold));

  nhpiBands.forEach(function (bn) {
    var img   = nhpi_cube.select(bn);
    var doy   = ee.Number.parse(bn.split('_').pop()).divide(1e6);
    var doyImg = ee.Image.constant(doy);

    var cond1 = img.gt(thresh).and(doyImg.gte(windowBeg)).and(maskImg.not());
    idx    = idx.where(cond1, doyImg);
    valIdx = valIdx.where(cond1, img);
    if (bn === firstBandName) { firstHit = firstHit.where(cond1, 1); }
    maskImg = maskImg.where(cond1, 1);

    var cond2 = img.gt(-2).and(maskImg.not());
    idxPrev  = idxPrev.where(cond2, doyImg);
    valPrev  = valPrev.where(cond2, img);
  });

  var interpDOY = idxPrev.add(
    thresh.subtract(valPrev)
          .divide(valIdx.subtract(valPrev))
          .multiply(idx.subtract(idxPrev))
  );

  idx       = idx.updateMask(maskImg);
  idxPrev   = idxPrev.updateMask(maskImg);
  interpDOY = interpDOY.updateMask(maskImg);

  var result = interpDOY.where(firstHit.eq(1), idx);

  /* 5. Apply crop mask (corn=1, soybean=5 in CDL) */
  var okMask = HPImax.gt(threshold_HPI_valid);
  var cdl = ee.Image('USDA/NASS/CDL/' + yearStart).select('cropland');
  currentMaskedResult = result
          .updateMask(okMask)
          .updateMask(cdl.eq(1).or(cdl.eq(5)))
          .rename('HarvestDate');

  /* 6. Add final map */
  var vis = {
    min: 230, max: 340,
    palette: [
      '0b3d0b','1a7300','4c9400','82b000','b8cc00',
      'fff000','ffb000','ff7800','ff4500','8b0000'
    ]
  };
  Map.addLayer(currentMaskedResult, vis, 'Estimated Harvest DOY');
  Map.centerObject(polygon, scale_factor);
}

/* Auto-run */
redraw();



