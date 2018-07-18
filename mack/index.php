<html>
<head>
    <title>Character Builder</title>
    <script src="//code.jquery.com/jquery-1.11.0.min.js"></script>
    <script src="paper-full.js"></script>
    <script src="canvastoblob.js"></script>
    <script src="filesaver.js"></script>
    <script>
        <?php
        $layers = [
            'body_back',
            'hair_extra',
            'hair_tail_back',
            'sword_back',
            'wing_back',
            'cloak_back',
            'body',
            'eyes',
            'socks',
            'pants',
            'shoes',
            'armor_leg',
            'shirt',

            'overcoat',

            'armor_chest',
            'armor_waist',
            'armor_arm',

            'cloak',
            'cloak_front',
            'armor_shoulder',
            'armor_shoulder_back',
            'hair_back',
            'hair_front',
            'hair_side_back',
            'hair_side_front',
            'wing',
            'wing_extra',
            'sword',
            'hat',

            'hair_tail_front',
            'hair_tail_extra',
        ];
        $items = [];
        foreach ($layers as $layer) {
            $items[$layer] = array_diff(scandir('female/' . $layer), ['.', '..']);
        }
        $blendModes = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'luminosity', 'color', 'add', 'subtract', 'average', 'pin-light', 'negation', 'source-over', 'source-in', 'source-out', 'source-atop', 'destination-over', 'destination-in', 'destination-out', 'destination-atop', 'lighter', 'darker', 'copy', 'xor'];
        ?>
        var layers = <?=json_encode($layers)?>;

        var items = {
            body_back: 'female/body_back/yw_basic-woman_b.png',
            body: 'female/body/yw_basic-woman_f.png'
        };
    </script>
    <script src="app.js"></script>
    <link rel="stylesheet" href="style.css">
    <!-- Latest compiled and minified CSS -->
    <link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.3.5/css/bootstrap.min.css">
</head>
<body>
<div class="container">
    <div class="row">
        <div class="col-md-2">
            <div class="puppet">
                <img src="loader.gif" id="loader" style="position:absolute;z-index:1;left:16px;top:16px;display:none;"/>
                <canvas id="sprite" width="128" height="192"></canvas>
            </div>
            <div class="puppet-control">
                <a onclick="$('.puppet').toggleClass('animated');" style="border: 1px solid black;">Animate</a>
                <a onclick="paper.view.element.toBlob(function(blob) { saveAs(blob, 'image.png');});"
                   style="border: 1px solid black;">Save to disk</a>
            </div>
        </div>
        <div class="col-md-10">
            <?php
            foreach ($layers as $layer):
                ?>
                <div class="item-row">
                    <div class="item">
                        <?= $layer ?><br/>
                        <input type='number' step='1' onchange="shift['$layer'] = parseInt(this.value);redraw(true);"
                               max="255" min="0" value="0"/><br/>
                        <select onchange="setBlendMode('$layer', this.value);">
                            <?php
                            foreach ($blendModes as $mode) {
                                echo "<option>" . $mode . "</option>";
                            }
                            ?>
                        </select>
                    </div>
                    <div class="item" style="opacity:0.2;background-color:purple;"
                         onclick="items['<?= $layer ?>'] = redraw();"></div>
                    <?php
                    foreach ($items[$layer] as $item):
                        ?>
                        <img class="item" id="female/<?= $layer ?>/<?= $item ?>" src="female/<?= $layer ?>/<?= $item ?>"
                             onclick="items['<?= $layer ?>'] = 'female/<?= $layer ?>/<?= $item ?>';redraw();"/>
                    <?php
                    endforeach;
                    ?>
                </div>
            <?php
            endforeach;
            ?>
        </div>
    </div>
</div>

</body>
</html>